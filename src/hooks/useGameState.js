import { useReducer, useEffect, useMemo, useCallback } from 'react';
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
} from '../data/gameData';
import { talentPointsForLevel, spentTalentPoints, canInvestTalent } from '../data/talents';

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
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    levelBatches = [...levelBatches, { remaining: POINTS_PER_LEVEL, spent: {} }];
    nextLog = pushLog(nextLog, `Level up! Agora você é nível ${level}. +${POINTS_PER_LEVEL} pontos de atributo.`);
    needed = xpForNextLevel(level);
  }
  return { xp, level, levelBatches, log: nextLog };
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

function createCharacter(className, name) {
  const raw = {
    name: name?.trim() || 'Aventureiro',
    class: className,
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
    currentHealth: 0,
    currentMana: 0,
    zoneId: ZONES[0].id,
    satiety: { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: [],
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
    autoCombat: false,
  };
}

// Todo o combate roda num único reducer, então "dano no monstro + spawn do próximo"
// acontece como UMA transição de estado atômica — não há como um tick ler um monstro
// desatualizado (a antiga versão guardava character/monster em dois useState + refs
// separados, e sob timers atrasados/acumulados isso podia fazer um hit "vazar" pro
// monstro seguinte já com vida baixa).
function reducer(state, action) {
  switch (action.type) {
    case 'CREATE_CHARACTER': {
      const character = createCharacter(action.className, action.name);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `Personagem ${character.name} (${action.className}) criado! Boa sorte na aventura.`),
        autoCombat: false,
      };
    }

    case 'RESET':
      return { character: null, monster: null, log: [], autoCombat: false };

    case 'SET_AUTO_COMBAT': {
      const value = typeof action.valueOrFn === 'function' ? action.valueOrFn(state.autoCombat) : action.valueOrFn;
      return { ...state, autoCombat: value };
    }

    case 'TICK': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0) return state;

      const charStats = computeFinalStats(char);
      // Fórmula real "Auto Attack Damage": ((WeaponDamage × (1 + Ability/100)) −
      // TargetDefense) / (1 + TargetArmor/100). Monstros só têm Armor (sem Defense
      // separado nos dados que temos), então TargetDefense=0 pro lado do jogador.
      const playerDamage = Math.max(
        1,
        (charStats.damage * (1 + charStats.ability / 100)) / (1 + currentMonster.armor / 100),
      );
      const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);
      let log = pushLog(state.log, `Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.`);

      if (monsterHealth <= 0) {
        const boosted = getDailyBoostedMonster().name === currentMonster.name;
        const boostMult = boosted ? BOOSTED_MULTIPLIER : 1;
        const { gold: rawGold, items: itemDrops } = rollLoot(currentMonster);
        const goldDrop = Math.round(rawGold * boostMult);
        const xpGain = Math.round(currentMonster.xp * boostMult);

        log = pushLog(log, `${currentMonster.name} derrotado! +${xpGain} XP.${boosted ? ' (boosted do dia!)' : ''}`);
        if (goldDrop > 0) log = pushLog(log, `+${goldDrop} gold.`);

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

        const { xp, level, levelBatches, log: logAfterXp } = applyXpGain(char, xpGain, log);
        log = logAfterXp;

        const zoneKills = { ...char.zoneKills, [char.zoneId]: (char.zoneKills[char.zoneId] ?? 0) + 1 };

        const updatedChar = {
          ...char,
          xp,
          level,
          levelBatches,
          gold: char.gold + goldDrop,
          kills: char.kills + 1,
          zoneKills,
          totalGoldEarned: char.totalGoldEarned + goldDrop,
          totalXpEarned: char.totalXpEarned + xpGain,
          inventory: mergedInventory,
        };
        const newStats = computeFinalStats(updatedChar);
        updatedChar.currentHealth = Math.min(newStats.health, char.currentHealth);
        updatedChar.currentMana = Math.min(newStats.mana, char.currentMana);

        return { ...state, character: updatedChar, monster: pickMonster(char.zoneId), log };
      }

      // Mesma fórmula real, do lado do monstro: monstro não tem Ability, personagem
      // mitiga com Defense (flat) e Armor (percentual com diminishing returns).
      const monsterDamage = Math.max(
        1,
        (currentMonster.damage - charStats.defense) / (1 + charStats.armor / 100),
      );
      log = pushLog(log, `${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`);
      const newHealth = Math.max(0, char.currentHealth - monsterDamage);

      let autoCombat = state.autoCombat;
      let deaths = char.deaths;
      if (newHealth <= 0) {
        deaths += 1;
        if (autoCombat) {
          autoCombat = false;
          log = pushLog(log, 'Você foi derrotado! Combate automático interrompido.');
        }
      }

      return {
        ...state,
        character: { ...char, currentHealth: newHealth, deaths },
        monster: { ...currentMonster, currentHealth: monsterHealth },
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
      const merchant = MERCHANTS_BY_NAME[action.merchantName];
      const offer = merchant?.sells.find((s) => s.name === action.itemName);
      if (!offer || char.gold < offer.price) return state;

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

    case 'EQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || !item.slot) return state;

      const slot = item.slot;
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
      const { xp, level, levelBatches, log } = applyXpGain(char, quest.rewardXp, log0);

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
      updatedChar.currentHealth = Math.min(newStats.health, char.currentHealth);
      updatedChar.currentMana = Math.min(newStats.mana, char.currentMana);

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

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    if (state.character) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
    }
  }, [state.character]);

  const hasCharacter = !!state.character;
  const isDead = hasCharacter && state.character.currentHealth <= 0;
  const attackSpeed = useMemo(
    () => (state.character ? computeFinalStats(state.character).attackSpeed : null),
    [state.character],
  );

  // Só recria o intervalo quando algo que muda o RITMO do combate muda de verdade
  // (ligar/desligar, attack speed, morte) — nunca a cada tick, que era a causa da
  // corrida entre monstro e personagem.
  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    // Fórmula real: Intervalo = 2s / (AttackSpeed / 10).
    const interval = TURN_MS / ((attackSpeed || 10) / 10);
    const id = setInterval(() => dispatch({ type: 'TICK' }), interval);
    return () => clearInterval(id);
  }, [state.autoCombat, attackSpeed, isDead, hasCharacter]);

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

  const createNewCharacter = useCallback((className, name) => dispatch({ type: 'CREATE_CHARACTER', className, name }), []);
  const resetCharacter = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET' });
  }, []);
  const setAutoCombat = useCallback((valueOrFn) => dispatch({ type: 'SET_AUTO_COMBAT', valueOrFn }), []);
  const consumeItem = useCallback((itemId) => dispatch({ type: 'CONSUME_ITEM', itemId }), []);
  const sellItem = useCallback((itemId, all) => dispatch({ type: 'SELL_ITEM', itemId, all }), []);
  const discardItem = useCallback((itemId) => dispatch({ type: 'DISCARD_ITEM', itemId }), []);
  const equipItem = useCallback((itemId) => dispatch({ type: 'EQUIP_ITEM', itemId }), []);
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
    resetCharacter,
    consumeItem,
    sellItem,
    discardItem,
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
    zones: ZONES,
  };
}
