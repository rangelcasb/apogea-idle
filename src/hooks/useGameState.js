import { useReducer, useEffect, useMemo, useCallback, useState } from 'react';
import {
  ZONES,
  STARTER_ITEMS,
  ITEM_TYPES,
  EQUIP_SLOTS,
  HAND_CAPACITY,
  POINTS_PER_LEVEL,
  BOOSTED_MULTIPLIER,
  xpForNextLevel,
  rollLoot,
  computeFinalStats,
  canAllocatePoint,
  allocatePoint,
  unspentPoints,
  getDailyBoostedMonster,
  FOOD_CATEGORIES,
  eatFood,
  tickSatiety,
  QUESTS_BY_ID,
  isQuestComplete,
  isQuestClaimed,
  getShopItemDefinition,
  slugify,
  MERCHANTS_BY_NAME,
  computeDamageRoll,
  VOCATION_COST,
  monsterDamageMultiplier,
} from '../data/gameData';
import { talentPointsForLevel, spentTalentPoints, canInvestTalent } from '../data/talents';
import {
  onAuthChange,
  loginWithGoogle,
  logout,
  saveGameState,
  loadGameState,
} from '../services/firebase';

const SYNC_DEBOUNCE_MS = 1500;

const TURN_MS = 2000;
// Fórmula real: "Regeneration triggers every 10 seconds, restoring half of your HP
// Regen and MP Regen stats each time."
const REGEN_TICK_MS = 10000;
const STORAGE_KEY = 'apogea-idle-character';
const RESPEC_COST = 200;

// Aplica ganho de XP e resolve level-ups (compartilhado entre matar monstro e
// reivindicar recompensa de quest). Retorna os campos atualizados + log com as
// mensagens de level-up já anexadas.
function applyXpGain(char, xpGain, log) {
  let xp = char.xp + xpGain;
  let level = char.level;
  let levelBatches = char.levelBatches;
  let needed = xpForNextLevel(level);
  let nextLog = log;
  let didLevelUp = false;
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    didLevelUp = true;
    levelBatches = [...levelBatches, { remaining: POINTS_PER_LEVEL, spent: {} }];
    nextLog = pushLog(nextLog, `Level up! Agora você é nível ${level}. +${POINTS_PER_LEVEL} pontos de atributo.`);
    needed = xpForNextLevel(level);
  }
  return { xp, level, levelBatches, log: nextLog, leveledUp: didLevelUp };
}

function inventoryWeight(inventory) {
  return inventory.reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0);
}

// Peso é um limite real (a tela mostra "MOCHILA — peso/capacidade OZ"): se pegar um
// item estourasse a capacidade, o item fica pra trás em vez de entrar na mochila.
function mergeLoot(inventory, droppedItems, capacity) {
  const next = [...inventory];
  let weight = inventoryWeight(next);
  const rejected = [];

  for (const drop of droppedItems) {
    const addedWeight = (drop.weight ?? 1) * drop.quantity;
    if (weight + addedWeight > capacity) {
      rejected.push(drop);
      continue;
    }
    const idx = next.findIndex((i) => i.id === drop.id);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + drop.quantity };
    } else {
      next.push({ ...drop });
    }
    weight += addedWeight;
  }
  return { inventory: next, rejected };
}

function emptyEquipment() {
  return Object.fromEntries(Object.keys(EQUIP_SLOTS).map((slot) => [slot, null]));
}

// Todo personagem começa como Squire — sem vocação, todos os multiplicadores
// neutros. Só depois de pagar VOCATION_COST em gold é que escolhe Knight/Rogue/Mage
// (escolha permanente, real do jogo).
function createCharacter(name) {
  const raw = {
    name: name?.trim() || 'Aventureiro',
    class: 'Squire',
    level: 1,
    xp: 0,
    gold: 0,
    kills: 0,
    deaths: 0,
    zoneKills: {},
    totalGoldEarned: 0,
    totalXpEarned: 0,
    levelBatches: [],
    talentPoints: {},
    equipment: emptyEquipment(),
    inventory: STARTER_ITEMS.map((i) => ({ ...i })),
    bank: [],
    monsterKills: {},
    itemBlacklist: [],
    currentHealth: 0,
    currentMana: 0,
    zoneId: ZONES[0].id,
    satiety: { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: [],
    autoCombat: false,
    updatedAt: Date.now(),
  };
  const stats = computeFinalStats(raw);
  raw.currentHealth = stats.health;
  raw.currentMana = stats.mana;
  return raw;
}

// Personagens salvos antes do sistema de pontos/equipamento/talentos não têm esses
// campos — preenchemos com valores neutros pra não quebrar a tela ao carregar um save
// antigo.
function migrateCharacter(char) {
  if (!char) return char;
  return {
    ...char,
    name: char.name ?? 'Aventureiro',
    kills: char.kills ?? 0,
    deaths: char.deaths ?? 0,
    zoneKills: char.zoneKills ?? {},
    totalGoldEarned: char.totalGoldEarned ?? char.gold ?? 0,
    totalXpEarned: char.totalXpEarned ?? char.xp ?? 0,
    levelBatches: char.levelBatches ?? [],
    talentPoints: char.talentPoints ?? {},
    equipment: char.equipment ?? emptyEquipment(),
    currentMana: char.currentMana ?? 0,
    satiety: char.satiety ?? { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: char.claimedQuests ?? [],
    inventory: char.inventory ?? [],
    bank: char.bank ?? [],
    monsterKills: char.monsterKills ?? {},
    itemBlacklist: char.itemBlacklist ?? [],
    autoCombat: char.autoCombat ?? false,
    updatedAt: char.updatedAt ?? 0,
  };
}

function pickMonster(zoneId) {
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const template = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  return { ...template, currentHealth: template.health, maxHealth: template.health };
}

function pushLog(log, message) {
  return [{ message, id: Date.now() + Math.random() }, ...log].slice(0, 50);
}

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const character = saved ? migrateCharacter(JSON.parse(saved)) : null;
  return {
    character,
    monster: character ? pickMonster(character.zoneId) : null,
    log: [],
    // Retoma o combate automático de onde parou — se estava caçando quando a aba
    // fechou (e não morreu), continua caçando ao reabrir.
    autoCombat: character?.autoCombat && character.currentHealth > 0,
    combatPauseUntil: 0,
  };
}

const MONSTER_TRANSITION_MS = 2000;

// Todo o combate roda num único reducer, então "dano no monstro + spawn do próximo"
// acontece como UMA transição de estado atômica — não há como um tick ler um monstro
// desatualizado (a antiga versão guardava character/monster em dois useState + refs
// separados, e sob timers atrasados/acumulados isso podia fazer um hit "vazar" pro
// monstro seguinte já com vida baixa).
function reducer(state, action) {
  switch (action.type) {
    case 'CREATE_CHARACTER': {
      const character = createCharacter(action.name);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `${character.name} chegou como Squire! Junte ${VOCATION_COST} gold pra escolher uma vocação.`),
        autoCombat: false,
      };
    }

    case 'CHOOSE_VOCATION': {
      const char = state.character;
      if (!char || char.class !== 'Squire' || char.gold < VOCATION_COST) return state;
      if (!['Knight', 'Rogue', 'Mage'].includes(action.vocation)) return state;

      const updatedChar = { ...char, class: action.vocation, gold: char.gold - VOCATION_COST };
      const s = computeFinalStats(updatedChar);
      updatedChar.currentHealth = Math.min(s.health, updatedChar.currentHealth);
      updatedChar.currentMana = Math.min(s.mana, updatedChar.currentMana);

      return {
        ...state,
        character: updatedChar,
        log: pushLog(
          state.log,
          `Você pagou ${VOCATION_COST} gold e se tornou ${action.vocation}! Essa escolha é definitiva.`,
        ),
      };
    }

    case 'LOAD_REMOTE_CHARACTER': {
      const character = migrateCharacter(action.character);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `Personagem sincronizado! Bem-vindo de volta, ${character.name}.`),
        autoCombat: character.autoCombat && character.currentHealth > 0,
      };
    }

    case 'RESET':
      return { character: null, monster: null, log: [], autoCombat: false };

    case 'SET_AUTO_COMBAT': {
      const value = typeof action.valueOrFn === 'function' ? action.valueOrFn(state.autoCombat) : action.valueOrFn;
      // Guarda no personagem também (não só no estado local) — é o que permite
      // salvar isso no localStorage/nuvem e retomar a caçada ao reabrir o jogo.
      const character = state.character ? { ...state.character, autoCombat: value } : state.character;
      return { ...state, character, autoCombat: value };
    }

    // Ataque do jogador e ataque do monstro rodam em RELÓGIOS INDEPENDENTES (ver
    // useGameState() mais abaixo), cada um no seu próprio intervalo real — se sua
    // Attack Speed for o dobro da do monstro, você bate 2x pra cada 1x dele, de verdade,
    // e não só "o combate passa mais rápido" (como era antes, quando os dois hits
    // aconteciam sempre juntos no mesmo tick).
    case 'PLAYER_ATTACK': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0) return state;
      // Pausa de 2s depois de derrotar um monstro, antes do próximo combate começar —
      // dá um respiro pra vida regenerar entre uma criatura e outra.
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);

      // Talentos de arma/armadura equipada (lifesteal de adaga, penetração de armor,
      // crítico...) só entram se o requisito ainda estiver ativo agora mesmo — troque
      // a arma e o talento correspondente liga/desliga na hora (ver talents.js).
      const isCrit = Math.random() < (charStats.critChance ?? 0);
      let baseDamage = computeDamageRoll(charStats).avg;
      if (isCrit) baseDamage *= charStats.critMultiplier ?? 1;
      // Bestiário: cada estrela ganha nessa criatura específica (marcos de abates) dá
      // +5% de dano só contra ela.
      baseDamage *= monsterDamageMultiplier(char.monsterKills?.[currentMonster.name] ?? 0);

      const effectiveArmor = Math.max(0, currentMonster.armor * (1 - (charStats.armorPenPercent ?? 0) / 100));
      const playerDamage = Math.max(1, baseDamage / (1 + effectiveArmor / 100));
      const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);

      const lifestealHeal = playerDamage * ((charStats.lifestealPercent ?? 0) / 100);

      let log = pushLog(
        state.log,
        `Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.${isCrit ? ' (crítico!)' : ''}`,
      );
      if (lifestealHeal > 0) {
        log = pushLog(log, `Lifesteal: +${lifestealHeal.toFixed(1)} de vida.`);
      }

      if (monsterHealth <= 0) {
        const boosted = getDailyBoostedMonster().name === currentMonster.name;
        const boostMult = boosted ? BOOSTED_MULTIPLIER : 1;
        const { gold: rawGold, items: rawItemDrops } = rollLoot(currentMonster);
        const goldDrop = Math.round(rawGold * boostMult);
        const xpGain = Math.round(currentMonster.xp * boostMult);

        log = pushLog(log, `${currentMonster.name} derrotado! +${xpGain} XP.${boosted ? ' (boosted do dia!)' : ''}`);
        if (goldDrop > 0) log = pushLog(log, `+${goldDrop} gold.`);

        // Itens na blacklist simplesmente não são pegos — nem entram na checagem de
        // peso/mochila cheia, como se o item nunca tivesse caído.
        const blacklist = new Set(char.itemBlacklist ?? []);
        const itemDrops = rawItemDrops.filter((item) => !blacklist.has(item.name));

        const { inventory: mergedInventory, rejected } = mergeLoot(char.inventory, itemDrops, charStats.capacity);
        for (const item of itemDrops) {
          const wasRejected = rejected.includes(item);
          log = pushLog(
            log,
            wasRejected
              ? `Mochila cheia! Você deixou ${item.name} x${item.quantity} para trás.`
              : `Você encontrou: ${item.name} x${item.quantity}.`,
          );
        }

        const { xp, level, levelBatches, log: logAfterXp, leveledUp } = applyXpGain(char, xpGain, log);
        log = logAfterXp;

        const zoneKills = { ...char.zoneKills, [char.zoneId]: (char.zoneKills[char.zoneId] ?? 0) + 1 };
        const monsterKills = {
          ...char.monsterKills,
          [currentMonster.name]: (char.monsterKills?.[currentMonster.name] ?? 0) + 1,
        };

        const updatedChar = {
          ...char,
          xp,
          level,
          levelBatches,
          gold: char.gold + goldDrop,
          kills: char.kills + 1,
          zoneKills,
          monsterKills,
          totalGoldEarned: char.totalGoldEarned + goldDrop,
          totalXpEarned: char.totalXpEarned + xpGain,
          inventory: mergedInventory,
        };
        const newStats = computeFinalStats(updatedChar);
        // Subir de nível enche vida e mana por completo — igual ao jogo real.
        updatedChar.currentHealth = leveledUp ? newStats.health : Math.min(newStats.health, char.currentHealth + lifestealHeal);
        updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);

        return {
          ...state,
          character: updatedChar,
          monster: pickMonster(char.zoneId),
          log,
          combatPauseUntil: Date.now() + MONSTER_TRANSITION_MS,
        };
      }

      const healthAfterLifesteal = Math.min(charStats.health, char.currentHealth + lifestealHeal);

      return {
        ...state,
        character: { ...char, currentHealth: healthAfterLifesteal },
        monster: { ...currentMonster, currentHealth: monsterHealth },
        log,
      };
    }

    case 'MONSTER_ATTACK': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0) return state;
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);
      // Mesma fórmula real, do lado do monstro: monstro não tem Ability, personagem
      // mitiga com Defense (flat) e Armor (percentual com diminishing returns).
      const monsterDamage = Math.max(
        1,
        (currentMonster.damage - charStats.defense) / (1 + charStats.armor / 100),
      );
      let log = pushLog(
        state.log,
        `${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`,
      );
      const newHealthRaw = Math.max(0, char.currentHealth - monsterDamage);

      let autoCombat = state.autoCombat;
      let deaths = char.deaths;
      let newHealth = newHealthRaw;
      if (newHealthRaw <= 0) {
        deaths += 1;
        autoCombat = false;
        // Ao morrer, a vida volta cheia (respawn instantâneo) — sem isso o personagem
        // ficava travado com 0 de vida pra sempre, já que o regen não age em vida 0.
        newHealth = charStats.health;
        log = pushLog(log, 'Você foi derrotado! Reviveu com a vida cheia. Combate automático interrompido.');
      }

      return {
        ...state,
        character: { ...char, currentHealth: newHealth, deaths, autoCombat },
        log,
        autoCombat,
      };
    }

    case 'REGEN_TICK': {
      const char = state.character;
      if (!char || char.currentHealth <= 0) return state;
      const s = computeFinalStats(char);
      // Fórmula real: a cada 10s, restaura METADE do stat de HP/MP Regen.
      let currentHealth = Math.min(s.health, char.currentHealth + s.hpRegen * 0.5);
      const currentMana = Math.min(s.mana, char.currentMana + s.mpRegen * 0.5);
      let inventory = char.inventory;
      let log = state.log;

      if (currentHealth < s.health * 0.8) {
        const foodIdx = inventory.findIndex(
          (i) => i.type === ITEM_TYPES.CONSUMABLE && i.stats?.health && i.quantity > 0,
        );
        if (foodIdx >= 0) {
          const food = inventory[foodIdx];
          currentHealth = Math.min(s.health, currentHealth + food.stats.health);
          inventory = inventory
            .map((i, idx) => (idx === foodIdx ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0);
          log = pushLog(log, `Você comeu ${food.name} e recuperou ${food.stats.health} de vida.`);
        }
      }

      const satiety = tickSatiety(char.satiety, REGEN_TICK_MS);

      if (
        currentHealth === char.currentHealth &&
        currentMana === char.currentMana &&
        inventory === char.inventory &&
        satiety === char.satiety
      ) {
        return state;
      }
      return { ...state, character: { ...char, currentHealth, currentMana, inventory, satiety }, log };
    }

    case 'CONSUME_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const s = computeFinalStats(char);
      let currentHealth = char.currentHealth;
      let currentMana = char.currentMana;
      let satiety = char.satiety;
      let log = state.log;

      if (item.stats?.health || item.stats?.mana) {
        if (item.stats?.health) {
          currentHealth = Math.min(s.health, currentHealth + item.stats.health);
          log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.health} de vida.`);
        }
        if (item.stats?.mana) {
          currentMana = Math.min(s.mana, currentMana + item.stats.mana);
          log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.mana} de mana.`);
        }
      } else if (FOOD_CATEGORIES.has(item.category)) {
        const wasSated = (char.satiety?.remainingMs ?? 0) > 0;
        satiety = eatFood(char.satiety, item.category);
        satiety.foodName = wasSated ? char.satiety.foodName : item.name;
        const totalMin = Math.round(satiety.remainingMs / 60000);
        log = pushLog(
          log,
          wasSated
            ? `Você comeu ${item.name}. Saciedade +${totalMin - Math.round(char.satiety.remainingMs / 60000)}min (bônus continua sendo de ${satiety.foodName}).`
            : `Você comeu ${item.name}. Saciado por ${totalMin}min.`,
        );
      }

      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return { ...state, character: { ...char, currentHealth, currentMana, satiety, inventory }, log };
    }

    case 'SELL_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra vender itens em combate — pare a caçada primeiro.') };
      }
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const sellQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const total = (item.sellPrice ?? 0) * sellQty;
      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - sellQty } : i))
        .filter((i) => i.quantity > 0);

      return {
        ...state,
        character: { ...char, gold: char.gold + total, totalGoldEarned: char.totalGoldEarned + total, inventory },
        log: pushLog(state.log, `Você vendeu ${sellQty}x ${item.name} por ${total} gold.`),
      };
    }

    case 'BUY_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra comprar itens em combate — pare a caçada primeiro.') };
      }
      const merchant = MERCHANTS_BY_NAME[action.merchantName];
      const offer = merchant?.sells.find((s) => s.name === action.itemName);
      if (!offer) {
        return { ...state, log: pushLog(state.log, `${merchant?.name ?? action.merchantName} não vende ${action.itemName}.`) };
      }
      if (char.gold < offer.price) {
        return {
          ...state,
          log: pushLog(state.log, `Gold insuficiente: ${action.itemName} custa ${offer.price}g, você tem ${char.gold}g.`),
        };
      }

      const def = getShopItemDefinition(action.itemName);
      const id = `${slugify(action.itemName)}-${def.rarity}`;
      const addedWeight = def.weight ?? 1;
      const currentWeight = inventoryWeight(char.inventory);
      const stats = computeFinalStats(char);
      if (currentWeight + addedWeight > stats.capacity) {
        return { ...state, log: pushLog(state.log, `Mochila cheia! Não coube ${action.itemName}.`) };
      }

      const idx = char.inventory.findIndex((i) => i.id === id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
        : [...char.inventory, { id, name: action.itemName, quantity: 1, ...def }];

      return {
        ...state,
        character: { ...char, gold: char.gold - offer.price, inventory },
        log: pushLog(state.log, `Você comprou ${action.itemName} de ${merchant.name} por ${offer.price} gold.`),
      };
    }

    case 'SELL_TO_MERCHANT': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra vender itens em combate — pare a caçada primeiro.') };
      }
      const merchant = MERCHANTS_BY_NAME[action.merchantName];
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;
      const offer = merchant?.buys.find((b) => b.name === item.name);
      const price = offer?.price ?? item.sellPrice ?? 0;

      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return {
        ...state,
        character: { ...char, gold: char.gold + price, totalGoldEarned: char.totalGoldEarned + price, inventory },
        log: pushLog(state.log, `Você vendeu ${item.name} para ${action.merchantName} por ${price} gold.`),
      };
    }

    case 'DISCARD_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item) return state;

      const inventory = char.inventory.filter((i) => i.id !== action.itemId);
      return {
        ...state,
        character: { ...char, inventory },
        log: pushLog(state.log, `Você descartou ${item.name}.`),
      };
    }

    case 'ADD_TO_BLACKLIST': {
      const char = state.character;
      const name = action.itemName?.trim();
      if (!char || !name) return state;
      const itemBlacklist = char.itemBlacklist ?? [];
      if (itemBlacklist.includes(name)) return state;
      return {
        ...state,
        character: { ...char, itemBlacklist: [...itemBlacklist, name] },
        log: pushLog(state.log, `${name} adicionado à blacklist — não será mais pego.`),
      };
    }

    case 'REMOVE_FROM_BLACKLIST': {
      const char = state.character;
      if (!char) return state;
      const itemBlacklist = (char.itemBlacklist ?? []).filter((n) => n !== action.itemName);
      return {
        ...state,
        character: { ...char, itemBlacklist },
        log: pushLog(state.log, `${action.itemName} removido da blacklist.`),
      };
    }

    case 'DEPOSIT_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra mexer no banco em combate — pare a caçada primeiro.') };
      }
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const moveQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - moveQty } : i))
        .filter((i) => i.quantity > 0);

      const idx = char.bank.findIndex((i) => i.id === item.id);
      const bank = idx >= 0
        ? char.bank.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + moveQty } : i))
        : [...char.bank, { ...item, quantity: moveQty }];

      return {
        ...state,
        character: { ...char, inventory, bank },
        log: pushLog(state.log, `Você guardou ${moveQty}x ${item.name} no banco.`),
      };
    }

    case 'WITHDRAW_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra mexer no banco em combate — pare a caçada primeiro.') };
      }
      const item = char.bank.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const moveQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const addedWeight = (item.weight ?? 1) * moveQty;
      const currentWeight = inventoryWeight(char.inventory);
      const stats = computeFinalStats(char);
      if (currentWeight + addedWeight > stats.capacity) {
        return { ...state, log: pushLog(state.log, `Mochila cheia! Não coube ${item.name}.`) };
      }

      const bank = char.bank
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - moveQty } : i))
        .filter((i) => i.quantity > 0);

      const idx = char.inventory.findIndex((i) => i.id === item.id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + moveQty } : i))
        : [...char.inventory, { ...item, quantity: moveQty }];

      return {
        ...state,
        character: { ...char, inventory, bank },
        log: pushLog(state.log, `Você retirou ${moveQty}x ${item.name} do banco.`),
      };
    }

    case 'EQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || !item.slot) return state;

      // Armas podem ir na mão principal OU secundária (dual-wield real do jogo) — só
      // itens de slot "weapon" aceitam esse destino alternativo; os demais slots são fixos.
      const slot = item.slot === 'weapon' && action.targetSlot === 'offhand' ? 'offhand' : item.slot;
      const previouslyEquipped = char.equipment[slot];

      // Tamanho das mãos: arma + mão secundária não podem somar mais que 10 (equipSize
      // real de cada item, "MÃOS: X/10" na tela do personagem).
      if (slot === 'weapon' || slot === 'offhand') {
        const otherSlot = slot === 'weapon' ? 'offhand' : 'weapon';
        const otherSize = char.equipment[otherSlot]?.equipSize ?? 0;
        if ((item.equipSize ?? 0) + otherSize > HAND_CAPACITY) {
          return {
            ...state,
            log: pushLog(state.log, `${item.name} não cabe nas mãos (tamanho ${item.equipSize ?? 0} + ${otherSize} > ${HAND_CAPACITY}).`),
          };
        }
      }

      let inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      if (previouslyEquipped) {
        const idx = inventory.findIndex((i) => i.id === previouslyEquipped.id);
        inventory = idx >= 0
          ? inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
          : [...inventory, { ...previouslyEquipped, quantity: 1 }];
      }

      const equipment = { ...char.equipment, [slot]: { ...item, quantity: 1 } };
      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);

      return { ...state, character: newChar, log: pushLog(state.log, `Você equipou ${item.name}.`) };
    }

    case 'UNEQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.equipment[action.slot];
      if (!item) return state;

      const idx = char.inventory.findIndex((i) => i.id === item.id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
        : [...char.inventory, { ...item, quantity: 1 }];

      const equipment = { ...char.equipment, [action.slot]: null };
      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);

      return { ...state, character: newChar, log: pushLog(state.log, `Você desequipou ${item.name}.`) };
    }

    case 'ALLOCATE_STAT': {
      const char = state.character;
      if (!char || !canAllocatePoint(char.levelBatches, action.stat)) return state;
      return { ...state, character: { ...char, levelBatches: allocatePoint(char.levelBatches, action.stat) } };
    }

    case 'RESET_ATTRIBUTES': {
      const char = state.character;
      if (!char || char.gold < RESPEC_COST || char.levelBatches.length === 0) return state;
      const levelBatches = char.levelBatches.map(() => ({ remaining: POINTS_PER_LEVEL, spent: {} }));
      return {
        ...state,
        character: { ...char, gold: char.gold - RESPEC_COST, levelBatches },
        log: pushLog(state.log, `Atributos resetados por ${RESPEC_COST} gold.`),
      };
    }

    case 'INVEST_TALENT': {
      const char = state.character;
      if (!char) return state;
      const available = talentPointsForLevel(char.level) - spentTalentPoints(char.talentPoints);
      if (available <= 0 || !canInvestTalent(char.talentPoints, action.talentId)) return state;
      const talentPoints = {
        ...char.talentPoints,
        [action.talentId]: (char.talentPoints[action.talentId] ?? 0) + 1,
      };
      return { ...state, character: { ...char, talentPoints } };
    }

    case 'CLAIM_QUEST': {
      const char = state.character;
      if (!char) return state;
      const quest = QUESTS_BY_ID[action.questId];
      if (!quest || isQuestClaimed(char, quest) || !isQuestComplete(char, quest)) return state;

      const log0 = pushLog(
        state.log,
        `Quest concluída: ${quest.description} — +${quest.rewardGold} gold, +${quest.rewardXp} XP.`,
      );
      const { xp, level, levelBatches, log, leveledUp } = applyXpGain(char, quest.rewardXp, log0);

      const updatedChar = {
        ...char,
        xp,
        level,
        levelBatches,
        gold: char.gold + quest.rewardGold,
        totalGoldEarned: char.totalGoldEarned + quest.rewardGold,
        totalXpEarned: char.totalXpEarned + quest.rewardXp,
        claimedQuests: [...char.claimedQuests, quest.id],
      };
      const newStats = computeFinalStats(updatedChar);
      // Subir de nível enche vida e mana por completo — igual ao jogo real.
      updatedChar.currentHealth = leveledUp ? newStats.health : Math.min(newStats.health, char.currentHealth);
      updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);

      return { ...state, character: updatedChar, log };
    }

    case 'CHANGE_ZONE': {
      if (!state.character) return state;
      return {
        ...state,
        character: { ...state.character, zoneId: action.zoneId },
        monster: pickMonster(action.zoneId),
      };
    }

    default:
      return state;
  }
}

// Toda vez que o reducer troca o personagem por um objeto novo, marca "updatedAt"
// agora. É isso que permite decidir, ao carregar em outro dispositivo, se o save
// local ou o da nuvem é o mais recente (sem isso, dar refresh no MESMO dispositivo
// podia sobrescrever com uma versão da nuvem levemente atrasada).
function reducerWithTimestamp(state, action) {
  const next = reducer(state, action);
  if (next.character && next.character !== state.character) {
    return { ...next, character: { ...next.character, updatedAt: Date.now() } };
  }
  return next;
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducerWithTimestamp, undefined, init);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [syncError, setSyncError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (state.character) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
    }
  }, [state.character]);

  // Login com Google dá o MESMO UID em qualquer dispositivo — é essa a chave usada
  // no Firestore, então não precisa de código nenhum pra continuar no celular.
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Ao logar: busca o personagem salvo na nuvem sob esse UID. Se for mais recente
  // que o local (jogou por outro dispositivo depois), usa a versão da nuvem.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const remote = await loadGameState(user.uid).catch(() => null);
      if (cancelled || !remote) return;
      if ((remote.updatedAt ?? 0) > (state.character?.updatedAt ?? 0)) {
        dispatch({ type: 'LOAD_REMOTE_CHARACTER', character: remote });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Salva na nuvem (debounced) toda vez que o personagem muda, sob o UID da conta
  // Google logada — é isso que faz o outro dispositivo puxar o progresso depois.
  useEffect(() => {
    if (!user || !state.character) return;
    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      saveGameState(user.uid, state.character)
        .then(() => {
          setSyncStatus('synced');
          setSyncError(null);
        })
        .catch((err) => {
          console.error('Falha ao sincronizar personagem:', err);
          setSyncStatus('error');
          setSyncError(err?.code || err?.message || 'Erro desconhecido.');
        });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [user, state.character]);

  const login = useCallback(() => {
    setAuthError(null);
    return loginWithGoogle().catch((err) => setAuthError(err?.code || err?.message || 'Erro desconhecido no login.'));
  }, []);
  const signOutUser = useCallback(() => logout().catch(() => {}), []);

  const hasCharacter = !!state.character;
  const isDead = hasCharacter && state.character.currentHealth <= 0;
  const attackSpeed = useMemo(
    () => (state.character ? computeFinalStats(state.character).attackSpeed : null),
    [state.character],
  );

  // Dois relógios independentes: o jogador ataca no ritmo da SUA Attack Speed, o
  // monstro ataca no ritmo dele (base real, já que não temos Attack Speed real por
  // monstro na fonte de dados) — attack speed dobrada = 2 hits seus pra cada 1 dele,
  // de verdade, não só "combate mais rápido". Só recria os intervalos quando algo que
  // muda o RITMO muda de verdade (ligar/desligar, attack speed, morte), nunca a cada
  // tick — isso evita a corrida que existia quando os dois lados dependiam do mesmo timer.
  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    // Fórmula real: Intervalo = 2s / (AttackSpeed / 10).
    const interval = TURN_MS / ((attackSpeed || 10) / 10);
    const id = setInterval(() => dispatch({ type: 'PLAYER_ATTACK' }), interval);
    return () => clearInterval(id);
  }, [state.autoCombat, attackSpeed, isDead, hasCharacter]);

  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    // Sem dado real de Attack Speed por monstro, usamos a base neutra do jogo
    // (AttackSpeed 10 → intervalo de 2s) pra todos os monstros.
    const id = setInterval(() => dispatch({ type: 'MONSTER_ATTACK' }), TURN_MS);
    return () => clearInterval(id);
  }, [state.autoCombat, isDead, hasCharacter]);

  useEffect(() => {
    if (!hasCharacter || isDead) return;
    const id = setInterval(() => dispatch({ type: 'REGEN_TICK' }), REGEN_TICK_MS);
    return () => clearInterval(id);
  }, [hasCharacter, isDead]);

  const stats = useMemo(
    () => (state.character ? computeFinalStats(state.character) : null),
    [state.character],
  );
  const character = state.character ? { ...state.character, stats } : null;

  const weight = useMemo(
    () => (state.character ? state.character.inventory.reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0) : 0),
    [state.character],
  );

  const createNewCharacter = useCallback((name) => dispatch({ type: 'CREATE_CHARACTER', name }), []);
  const chooseVocation = useCallback((vocation) => dispatch({ type: 'CHOOSE_VOCATION', vocation }), []);
  const resetCharacter = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET' });
  }, []);
  const setAutoCombat = useCallback((valueOrFn) => dispatch({ type: 'SET_AUTO_COMBAT', valueOrFn }), []);
  const consumeItem = useCallback((itemId) => dispatch({ type: 'CONSUME_ITEM', itemId }), []);
  const sellItem = useCallback((itemId, all) => dispatch({ type: 'SELL_ITEM', itemId, all }), []);
  const discardItem = useCallback((itemId) => dispatch({ type: 'DISCARD_ITEM', itemId }), []);
  const depositItem = useCallback((itemId, all) => dispatch({ type: 'DEPOSIT_ITEM', itemId, all }), []);
  const withdrawItem = useCallback((itemId, all) => dispatch({ type: 'WITHDRAW_ITEM', itemId, all }), []);
  const addToBlacklist = useCallback((itemName) => dispatch({ type: 'ADD_TO_BLACKLIST', itemName }), []);
  const removeFromBlacklist = useCallback((itemName) => dispatch({ type: 'REMOVE_FROM_BLACKLIST', itemName }), []);
  const equipItem = useCallback((itemId, targetSlot) => dispatch({ type: 'EQUIP_ITEM', itemId, targetSlot }), []);
  const unequipItem = useCallback((slot) => dispatch({ type: 'UNEQUIP_ITEM', slot }), []);
  const allocateStat = useCallback((stat) => dispatch({ type: 'ALLOCATE_STAT', stat }), []);
  const resetAttributes = useCallback(() => dispatch({ type: 'RESET_ATTRIBUTES' }), []);
  const investTalent = useCallback((talentId) => dispatch({ type: 'INVEST_TALENT', talentId }), []);
  const changeZone = useCallback((zoneId) => dispatch({ type: 'CHANGE_ZONE', zoneId }), []);
  const claimQuest = useCallback((questId) => dispatch({ type: 'CLAIM_QUEST', questId }), []);
  const buyItem = useCallback((merchantName, itemName) => dispatch({ type: 'BUY_ITEM', merchantName, itemName }), []);
  const sellToMerchant = useCallback(
    (merchantName, itemId) => dispatch({ type: 'SELL_TO_MERCHANT', merchantName, itemId }),
    [],
  );

  return {
    character,
    monster: state.monster,
    log: state.log,
    autoCombat: state.autoCombat,
    setAutoCombat,
    createNewCharacter,
    chooseVocation,
    vocationCost: VOCATION_COST,
    resetCharacter,
    consumeItem,
    sellItem,
    discardItem,
    depositItem,
    withdrawItem,
    addToBlacklist,
    removeFromBlacklist,
    equipItem,
    unequipItem,
    allocateStat,
    resetAttributes,
    respecCost: RESPEC_COST,
    investTalent,
    talentPointsAvailable: state.character
      ? talentPointsForLevel(state.character.level) - spentTalentPoints(state.character.talentPoints)
      : 0,
    unspentPoints: state.character ? unspentPoints(state.character.levelBatches) : 0,
    weight,
    changeZone,
    claimQuest,
    buyItem,
    sellToMerchant,
    syncStatus,
    syncError,
    user,
    authLoading,
    authError,
    login,
    logout: signOutUser,
    zones: ZONES,
  };
}
