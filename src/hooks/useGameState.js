import { useReducer, useEffect, useMemo, useCallback, useState, useRef } from 'react';
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
  rarityAtLeast,
  RARITY_LABELS,
  SPELLS_BY_ID,
  SPELL_SLOTS,
  DEFAULT_HEAL_THRESHOLD_PCT,
  computeSpellEffect,
  canCastSpell,
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
const TALENT_RESET_BASE_COST = 200;
// Progresso offline: no máximo 8h de recompensa, e só XP/gold (nada de item — não
// tem como saber que peso "teria" cabido na mochila do jeito que o real drop escolhe).
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const OFFLINE_MIN_MS = 60 * 1000; // ignora hiatos triviais (ex: dar refresh na página)

// Custo dobra a cada reset de talentos (200, 400, 800, 1600...) — não é um valor real
// do jogo (o jogo real não deixa resetar talentos livremente), é uma mecânica nossa
// pra desencorajar respec repetido sem travar de vez.
function talentResetCost(resetCount) {
  return TALENT_RESET_BASE_COST * 2 ** (resetCount ?? 0);
}

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

// Comer automático (opção "Comer automático" do painel Personagem): come TODA comida
// de saciedade (RawFood/EdibleFood/CookedFood/SpecialFood/Drinks) que estiver na
// mochila assim que ela chega — seja de loot ou de compra no mercador. Come a pilha
// inteira de uma vez (a duração de cada unidade soma, igual comer manualmente várias
// vezes seguidas).
function autoEatAllFood(inventory, satiety, log) {
  let nextInventory = inventory;
  let nextSatiety = satiety;
  let nextLog = log;

  for (const item of inventory) {
    if (!FOOD_CATEGORIES.has(item.category) || item.quantity <= 0) continue;
    for (let i = 0; i < item.quantity; i++) {
      nextSatiety = eatFood(nextSatiety, item.category);
    }
    nextSatiety.foodName = nextSatiety.foodName ?? item.name;
    nextInventory = nextInventory.filter((it) => it.id !== item.id);
    nextLog = pushLog(
      nextLog,
      `Você comeu ${item.name} x${item.quantity} automaticamente. Saciado por ${Math.round(nextSatiety.remainingMs / 60000)}min.`,
    );
  }

  return { inventory: nextInventory, satiety: nextSatiety, log: nextLog };
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
    talentResetCount: 0,
    currentHealth: 0,
    currentMana: 0,
    zoneId: ZONES[0].id,
    satiety: { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: [],
    autoCombat: false,
    autoEat: false,
    learnedSpells: [],
    equippedSpells: Array(SPELL_SLOTS).fill(null),
    autoCastSpells: false,
    autoPotion: { enabled: false, healthPct: 30, manaPct: 30 },
    spellHealThresholds: {},
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
    // Formato antigo era um array de strings (nome do item, sempre bloqueado em
    // qualquer raridade) — convertido pro formato novo { name, minRarity }.
    itemBlacklist: (char.itemBlacklist ?? []).map((entry) =>
      typeof entry === 'string' ? { name: entry, minRarity: null } : entry,
    ),
    autoCombat: char.autoCombat ?? false,
    autoEat: char.autoEat ?? false,
    talentResetCount: char.talentResetCount ?? 0,
    learnedSpells: char.learnedSpells ?? [],
    equippedSpells: char.equippedSpells ?? Array(SPELL_SLOTS).fill(null),
    autoCastSpells: char.autoCastSpells ?? false,
    autoPotion: char.autoPotion ?? { enabled: false, healthPct: 30, manaPct: 30 },
    spellHealThresholds: char.spellHealThresholds ?? {},
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
    spellCooldowns: {},
  };
}

// Acha a maior poção disponível na mochila pra um stat (health/mana) — usar a maior
// primeiro é mais eficiente pro auto-uso (menos vezes que precisa checar de novo).
function findBestPotion(inventory, statKey) {
  let best = null;
  let bestIdx = -1;
  inventory.forEach((item, idx) => {
    if (item.category === 'Potions' && item.stats?.[statKey] > 0 && item.quantity > 0) {
      if (!best || item.stats[statKey] > best.stats[statKey]) {
        best = item;
        bestIdx = idx;
      }
    }
  });
  return bestIdx >= 0 ? { item: best, idx: bestIdx } : null;
}

// Poção automática: se a vida ou a mana caírem pra igual ou abaixo da % configurada
// pelo jogador, usa a maior poção disponível daquele tipo — igual clicar "USAR" na
// mochila, só que sozinho. Checado depois de qualquer coisa que reduza vida/mana
// (ataque do monstro, gasto de mana em magia) e também no tick de regeneração como
// rede de segurança.
function autoUsePotions(char, stats, log) {
  const auto = char.autoPotion;
  let inventory = char.inventory;
  let currentHealth = char.currentHealth;
  let currentMana = char.currentMana;
  if (!auto?.enabled || currentHealth <= 0) return { inventory, currentHealth, currentMana, log };

  if (stats.health > 0 && (currentHealth / stats.health) * 100 <= auto.healthPct) {
    const found = findBestPotion(inventory, 'health');
    if (found) {
      currentHealth = Math.min(stats.health, currentHealth + found.item.stats.health);
      inventory = inventory
        .map((i, idx) => (idx === found.idx ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      log = pushLog(log, `Poção automática: você usou ${found.item.name} e recuperou ${found.item.stats.health} de vida.`);
    }
  }

  if (stats.mana > 0 && (currentMana / stats.mana) * 100 <= auto.manaPct) {
    const found = findBestPotion(inventory, 'mana');
    if (found) {
      currentMana = Math.min(stats.mana, currentMana + found.item.stats.mana);
      inventory = inventory
        .map((i, idx) => (idx === found.idx ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      log = pushLog(log, `Poção automática: você usou ${found.item.name} e recuperou ${found.item.stats.mana} de mana.`);
    }
  }

  return { inventory, currentHealth, currentMana, log };
}

const MONSTER_TRANSITION_MS = 2000;

// Derrota de um monstro: XP, gold, drops (respeitando blacklist), auto-come comida e
// sobe de nível — usado tanto por PLAYER_ATTACK (golpe normal) quanto por SPELL_CAST
// (magia matando o monstro), pra não duplicar essa lógica toda em dois lugares.
function defeatMonster(char, currentMonster, log, { lifestealHeal = 0, selfDamage = 0 } = {}) {
  const boosted = getDailyBoostedMonster().name === currentMonster.name;
  const boostMult = boosted ? BOOSTED_MULTIPLIER : 1;
  const { gold: rawGold, items: rawItemDrops } = rollLoot(currentMonster);
  const goldDrop = Math.round(rawGold * boostMult);
  const xpGain = Math.round(currentMonster.xp * boostMult);

  log = pushLog(log, `${currentMonster.name} derrotado! +${xpGain} XP.${boosted ? ' (boosted do dia!)' : ''}`);
  if (goldDrop > 0) log = pushLog(log, `+${goldDrop} gold.`);

  // Itens na blacklist simplesmente não são pegos — nem entram na checagem de
  // peso/mochila cheia, como se o item nunca tivesse caído. Uma entrada pode
  // ter raridade mínima (ex: "Torch" só é bloqueada abaixo de épico).
  const blacklistMap = new Map((char.itemBlacklist ?? []).map((e) => [e.name, e.minRarity]));
  const itemDrops = rawItemDrops.filter((item) => {
    if (!blacklistMap.has(item.name)) return true;
    const minRarity = blacklistMap.get(item.name);
    return minRarity ? rarityAtLeast(item.rarity, minRarity) : false;
  });

  const charStats = computeFinalStats(char);

  // Com comer automático ligado, comida nem entra na checagem de peso — ela é
  // comida na hora, nunca fica ocupando espaço, então "mochila cheia" não deve
  // bloquear um alimento que nem vai ficar guardado.
  const foodDrops = char.autoEat ? itemDrops.filter((i) => FOOD_CATEGORIES.has(i.category)) : [];
  const nonFoodDrops = char.autoEat ? itemDrops.filter((i) => !FOOD_CATEGORIES.has(i.category)) : itemDrops;

  const { inventory: mergedInventory, rejected } = mergeLoot(char.inventory, nonFoodDrops, charStats.capacity);
  for (const item of nonFoodDrops) {
    const wasRejected = rejected.includes(item);
    log = pushLog(
      log,
      wasRejected
        ? `Mochila cheia! Você deixou ${item.name} x${item.quantity} para trás.`
        : `Você encontrou: ${item.name} x${item.quantity}.`,
    );
  }

  let inventoryAfterLoot = mergedInventory;
  let satiety = char.satiety;
  for (const food of foodDrops) {
    for (let i = 0; i < food.quantity; i++) satiety = eatFood(satiety, food.category);
    satiety.foodName = satiety.foodName ?? food.name;
    log = pushLog(
      log,
      `Você comeu ${food.name} x${food.quantity} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`,
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
    inventory: inventoryAfterLoot,
    satiety,
  };
  const newStats = computeFinalStats(updatedChar);
  // Subir de nível enche vida e mana por completo — igual ao jogo real.
  // Dark Blade / feitiços com custo de HP podem causar dano em você mesmo — não
  // deixamos matar nessa hora pra não duplicar a lógica de morte/respawn do
  // MONSTER_ATTACK, só reduz até o mínimo de 1 de vida.
  updatedChar.currentHealth = leveledUp
    ? newStats.health
    : Math.max(1, Math.min(newStats.health, char.currentHealth + lifestealHeal) - selfDamage);
  updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);

  return {
    character: updatedChar,
    monster: pickMonster(char.zoneId),
    log,
    combatPauseUntil: Date.now() + MONSTER_TRANSITION_MS,
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

    case 'SET_AUTO_EAT': {
      const char = state.character;
      if (!char) return state;
      // Ligar a opção já come na hora toda comida que estiver parada na mochila —
      // não só a que chegar depois.
      let inventory = char.inventory;
      let satiety = char.satiety;
      let log = state.log;
      if (action.enabled) {
        const eaten = autoEatAllFood(inventory, satiety, log);
        inventory = eaten.inventory;
        satiety = eaten.satiety;
        log = eaten.log;
      }
      return { ...state, character: { ...char, autoEat: action.enabled, inventory, satiety }, log };
    }

    case 'SET_AUTO_POTION': {
      const char = state.character;
      if (!char) return state;
      return { ...state, character: { ...char, autoPotion: { ...char.autoPotion, ...action.settings } } };
    }

    // Cada magia de cura tem seu próprio limiar de vida (%) pra entrar em ação sozinha
    // — sem isso, o auto-cast curaria toda vez que o cooldown liberasse, mesmo com a
    // vida quase cheia, só pra recuperar 5% de quase nada.
    case 'SET_SPELL_HEAL_THRESHOLD': {
      const char = state.character;
      if (!char) return state;
      return {
        ...state,
        character: { ...char, spellHealThresholds: { ...char.spellHealThresholds, [action.spellId]: action.pct } },
      };
    }

    // Ler um livro de magia ensina o feitiço PRA SEMPRE (consome 1 unidade do livro,
    // igual ao jogo real) — não precisa manter o livro guardado depois disso.
    case 'LEARN_SPELL': {
      const char = state.character;
      if (!char) return state;
      const spell = SPELLS_BY_ID[action.spellId];
      if (!spell || char.learnedSpells.includes(action.spellId)) return state;
      const bookIdx = char.inventory.findIndex((i) => i.name === spell.book && i.quantity > 0);
      if (bookIdx < 0) {
        return { ...state, log: pushLog(state.log, `Você precisa ter ${spell.book} na mochila pra aprender essa magia.`) };
      }
      const inventory = char.inventory
        .map((i, idx) => (idx === bookIdx ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      return {
        ...state,
        character: { ...char, inventory, learnedSpells: [...char.learnedSpells, action.spellId] },
        log: pushLog(state.log, `Você aprendeu a magia ${spell.id}!`),
      };
    }

    case 'EQUIP_SPELL': {
      const char = state.character;
      if (!char) return state;
      if (!char.learnedSpells.includes(action.spellId)) return state;
      if (action.slotIndex < 0 || action.slotIndex >= SPELL_SLOTS) return state;
      // Uma magia só pode ocupar um slot por vez — se já tava equipada em outro, tira de lá.
      const equippedSpells = char.equippedSpells.map((s, idx) => {
        if (idx === action.slotIndex) return action.spellId;
        return s === action.spellId ? null : s;
      });
      return { ...state, character: { ...char, equippedSpells } };
    }

    case 'UNEQUIP_SPELL': {
      const char = state.character;
      if (!char) return state;
      const equippedSpells = char.equippedSpells.map((s, idx) => (idx === action.slotIndex ? null : s));
      return { ...state, character: { ...char, equippedSpells } };
    }

    case 'SET_AUTO_CAST_SPELLS': {
      const char = state.character;
      if (!char) return state;
      return { ...state, character: { ...char, autoCastSpells: action.enabled } };
    }

    // Roda num relógio próprio (ver useGameState() mais abaixo), independente do
    // ataque físico — cada magia equipada tem seu próprio cooldown (spellCooldowns,
    // fora do personagem: é estado de combate efêmero, não precisa ser salvo).
    case 'SPELL_CAST': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0 || !char.autoCastSpells) return state;
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);
      const now = Date.now();
      const equipped = char.equippedSpells.filter(Boolean);
      if (equipped.length === 0) return state;

      let spellCooldowns = state.spellCooldowns;
      let workingChar = char;
      let workingMonster = currentMonster;
      let log = state.log;
      let combatPauseUntil = state.combatPauseUntil;

      for (const spellId of equipped) {
        const spell = SPELLS_BY_ID[spellId];
        if (!spell) continue;
        if (!workingMonster || workingChar.currentHealth <= 0) break;
        if ((spellCooldowns[spellId] ?? 0) > now) continue;
        if (!canCastSpell(spell, charStats)) continue;
        const costPool = spell.hpCast ? workingChar.currentHealth : workingChar.currentMana;
        if (costPool < spell.manaCost) continue;

        // Magia de cura só entra em ação quando a vida cair pra igual ou abaixo do
        // limiar configurado pelo jogador (senão ficaria curando 5% de quase nada toda
        // vez que o cooldown liberasse, mesmo com a vida praticamente cheia).
        if (spell.kind === 'heal') {
          const healthPct = (workingChar.currentHealth / charStats.health) * 100;
          const threshold = char.spellHealThresholds?.[spellId] ?? DEFAULT_HEAL_THRESHOLD_PCT;
          if (healthPct > threshold) continue;
        }

        spellCooldowns = { ...spellCooldowns, [spellId]: now + spell.cooldownMs };

        if (spell.kind === 'heal') {
          const missingHealth = charStats.health - workingChar.currentHealth;
          const healAmount = missingHealth * ((spell.missingHealthPct ?? 0) / 100);
          const currentHealth = spell.hpCast
            ? Math.max(1, workingChar.currentHealth - spell.manaCost)
            : workingChar.currentHealth;
          const currentMana = spell.hpCast ? workingChar.currentMana : workingChar.currentMana - spell.manaCost;
          workingChar = {
            ...workingChar,
            currentHealth: Math.min(charStats.health, currentHealth + healAmount),
            currentMana,
          };
          log = pushLog(log, `Você conjurou ${spell.id} e recuperou ${healAmount.toFixed(1)} de vida.`);
          continue;
        }

        const { avg: avgWeaponDamage } = computeDamageRoll(charStats);
        const rawDamage = computeSpellEffect(spell, charStats, avgWeaponDamage);
        const effectiveArmor = Math.max(0, workingMonster.armor * (1 - (charStats.armorPenPercent ?? 0) / 100));
        const spellDamage = Math.max(1, (rawDamage - effectiveArmor / 2) / (1 + effectiveArmor / 100));

        const currentHealth = spell.hpCast ? Math.max(1, workingChar.currentHealth - spell.manaCost) : workingChar.currentHealth;
        const currentMana = spell.hpCast ? workingChar.currentMana : workingChar.currentMana - spell.manaCost;
        workingChar = { ...workingChar, currentHealth, currentMana };

        log = pushLog(log, `Você conjurou ${spell.id} e causou ${spellDamage.toFixed(1)} de dano em ${workingMonster.name}.`);

        const monsterHealth = Math.max(0, workingMonster.currentHealth - spellDamage);
        if (monsterHealth <= 0) {
          const result = defeatMonster(workingChar, workingMonster, log);
          workingChar = result.character;
          workingMonster = result.monster;
          log = result.log;
          combatPauseUntil = result.combatPauseUntil;
        } else {
          workingMonster = { ...workingMonster, currentHealth: monsterHealth };
        }
      }

      if (workingChar === char && workingMonster === currentMonster && spellCooldowns === state.spellCooldowns) {
        return state;
      }

      // Gasto de mana/HP em magia é o outro grande motivo de precisar de poção
      // automática além do dano do monstro — checa de novo aqui no final do cast.
      const potionResult = autoUsePotions(workingChar, charStats, log);
      workingChar = { ...workingChar, inventory: potionResult.inventory, currentHealth: potionResult.currentHealth, currentMana: potionResult.currentMana };
      log = potionResult.log;

      return { ...state, character: workingChar, monster: workingMonster, log, combatPauseUntil, spellCooldowns };
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

      // Um golpe: dano físico normal (com crítico e mitigação de armadura) + a chance
      // de dano-verdadeiro da adaga (Jagged Rhythm), que ignora armadura por completo
      // e não é afetado por crítico. Talentos de arma/armadura só entram se o requisito
      // ainda estiver ativo agora mesmo — troque a arma e eles ligam/desligam na hora.
      function rollHit() {
        const isCrit = Math.random() < (charStats.critChance ?? 0);
        // Cada golpe sorteia um valor dentro do range min-máx real (igual a barra
        // "Dano por golpe X-Y" mostra) — usar sempre a média fazia todo hit sair com o
        // mesmo número, sem a variação que o jogo real tem.
        const { min: minDamage, max: maxDamage } = computeDamageRoll(charStats);
        let dmg = minDamage + Math.random() * (maxDamage - minDamage);
        if (isCrit) dmg *= charStats.critMultiplier ?? 1;
        // Bestiário: cada estrela ganha nessa criatura específica (marcos de abates) dá
        // +5% de dano só contra ela.
        dmg *= monsterDamageMultiplier(char.monsterKills?.[currentMonster.name] ?? 0);

        // Fórmula real de Armadura (apogean.eu/lists/formulae): (Dano - Armadura/2) /
        // (1 + Armadura/100) — tem uma parte flat ANTES da percentual, não só a %.
        const effectiveArmor = Math.max(0, currentMonster.armor * (1 - (charStats.armorPenPercent ?? 0) / 100));
        const damage = Math.max(1, (dmg - effectiveArmor / 2) / (1 + effectiveArmor / 100));

        // Jagged Rhythm: 50% de chance de causar (Ability/4) de dano verdadeiro extra,
        // ignorando a armadura. Dark Blade dobra esse dano verdadeiro, mas você recebe
        // a mesma quantia de volta.
        let trueDamage = 0;
        if (charStats.trueDamageChance && Math.random() < charStats.trueDamageChance) {
          trueDamage = charStats.trueDamagePerHit ?? 0;
          if (charStats.trueDamageDoubled) trueDamage *= 2;
        }
        const selfTrueDamage = charStats.trueDamageDoubled && trueDamage > 0 ? trueDamage : 0;

        return { damage, isCrit, trueDamage, selfTrueDamage };
      }

      // Luck Foreseen II: Ability/6 = % de chance de atacar duas vezes no mesmo golpe.
      const hits = [rollHit()];
      if (charStats.doubleAttackChance && Math.random() < charStats.doubleAttackChance) {
        hits.push(rollHit());
      }
      const isCrit = hits.some((h) => h.isCrit);
      const totalTrueDamage = hits.reduce((sum, h) => sum + h.trueDamage, 0);
      const totalSelfDamage = hits.reduce((sum, h) => sum + h.selfTrueDamage, 0);
      const playerDamage = hits.reduce((sum, h) => sum + h.damage, 0) + totalTrueDamage;
      const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);

      const lifestealHeal = playerDamage * ((charStats.lifestealPercent ?? 0) / 100);

      let log = pushLog(
        state.log,
        `Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.${isCrit ? ' (crítico!)' : ''}${hits.length > 1 ? ' (ataque duplo!)' : ''}`,
      );
      if (totalTrueDamage > 0) {
        log = pushLog(log, `Dano verdadeiro: +${totalTrueDamage.toFixed(1)} (ignora armadura).`);
      }
      if (lifestealHeal > 0) {
        log = pushLog(log, `Lifesteal: +${lifestealHeal.toFixed(1)} de vida.`);
      }
      if (totalSelfDamage > 0) {
        log = pushLog(log, `Dark Blade: você recebeu ${totalSelfDamage.toFixed(1)} de dano verdadeiro.`);
      }

      if (monsterHealth <= 0) {
        return { ...state, ...defeatMonster(char, currentMonster, log, { lifestealHeal, selfDamage: totalSelfDamage }) };
      }

      const healthAfterLifesteal = Math.max(
        1,
        Math.min(charStats.health, char.currentHealth + lifestealHeal) - totalSelfDamage,
      );

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
      // Duas mitigações reais aplicadas em sequência (apogean.eu/lists/formulae):
      // Defense primeiro — (DanoDoAtacante - Defesa) / NúmeroDeAtacantes (sempre 1
      // atacante aqui) — depois Armor — (Resultado - Armadura/2) / (1 + Armadura/100).
      const afterDefense = Math.max(0, currentMonster.damage - charStats.defense);
      const monsterDamage = Math.max(1, (afterDefense - charStats.armor / 2) / (1 + charStats.armor / 100));
      let log = pushLog(
        state.log,
        `${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`,
      );
      const newHealthRaw = Math.max(0, char.currentHealth - monsterDamage);

      let autoCombat = state.autoCombat;
      let deaths = char.deaths;
      let newHealth = newHealthRaw;
      let inventory = char.inventory;
      let currentMana = char.currentMana;
      if (newHealthRaw <= 0) {
        deaths += 1;
        autoCombat = false;
        // Ao morrer, a vida volta cheia (respawn instantâneo) — sem isso o personagem
        // ficava travado com 0 de vida pra sempre, já que o regen não age em vida 0.
        newHealth = charStats.health;
        log = pushLog(log, 'Você foi derrotado! Reviveu com a vida cheia. Combate automático interrompido.');
      } else {
        const potionResult = autoUsePotions({ ...char, currentHealth: newHealthRaw }, charStats, log);
        inventory = potionResult.inventory;
        newHealth = potionResult.currentHealth;
        currentMana = potionResult.currentMana;
        log = potionResult.log;
      }

      return {
        ...state,
        character: { ...char, currentHealth: newHealth, currentMana, deaths, autoCombat, inventory },
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

      let satiety = tickSatiety(char.satiety, REGEN_TICK_MS);

      // Comer automático (opção ligada no painel do Personagem): se a saciedade zerou
      // e sobrou comida na mochila (normalmente não sobra, já que agora se come na
      // hora que a comida chega), come sozinho como último recurso.
      if (char.autoEat && satiety.remainingMs <= 0) {
        const foodIdx = inventory.findIndex((i) => FOOD_CATEGORIES.has(i.category) && i.quantity > 0);
        if (foodIdx >= 0) {
          const food = inventory[foodIdx];
          satiety = eatFood(satiety, food.category);
          satiety.foodName = food.name;
          inventory = inventory
            .map((i, idx) => (idx === foodIdx ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0);
          log = pushLog(log, `Você comeu ${food.name} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`);
        }
      }

      // Rede de segurança da poção automática: cobre qualquer queda de vida/mana que
      // não passou pelos outros pontos de checagem (ex: dano verdadeiro que você
      // recebe de volta do Dark Blade).
      const potionResult = autoUsePotions({ ...char, currentHealth, currentMana, inventory }, s, log);
      inventory = potionResult.inventory;
      currentHealth = potionResult.currentHealth;
      const currentManaAfterPotion = potionResult.currentMana;
      log = potionResult.log;

      if (
        currentHealth === char.currentHealth &&
        currentManaAfterPotion === char.currentMana &&
        inventory === char.inventory &&
        satiety === char.satiety
      ) {
        return state;
      }
      return { ...state, character: { ...char, currentHealth, currentMana: currentManaAfterPotion, inventory, satiety }, log };
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
      let log = pushLog(state.log, `Você comprou ${action.itemName} de ${merchant.name} por ${offer.price} gold.`);
      let satiety = char.satiety;

      // Comida comprada com comer automático ligado é comida na hora — não depende de
      // espaço na mochila (nunca chega a ficar guardada).
      if (char.autoEat && FOOD_CATEGORIES.has(def.category)) {
        satiety = eatFood(satiety, def.category);
        satiety.foodName = satiety.foodName ?? action.itemName;
        log = pushLog(log, `Você comeu ${action.itemName} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`);
        return { ...state, character: { ...char, gold: char.gold - offer.price, satiety }, log };
      }

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
        character: { ...char, gold: char.gold - offer.price, inventory, satiety },
        log,
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
      // minRarity null = bloqueia o item em qualquer raridade; com minRarity, só
      // bloqueia abaixo dela (ex: Torch com minRarity "epic" deixa passar épico+).
      const minRarity = action.minRarity ?? null;
      const itemBlacklist = (char.itemBlacklist ?? []).filter((e) => e.name !== name);
      const message = minRarity
        ? `${name} adicionado à blacklist — só será pego a partir de ${RARITY_LABELS[minRarity] ?? minRarity}.`
        : `${name} adicionado à blacklist — não será mais pego.`;
      return {
        ...state,
        character: { ...char, itemBlacklist: [...itemBlacklist, { name, minRarity }] },
        log: pushLog(state.log, message),
      };
    }

    case 'REMOVE_FROM_BLACKLIST': {
      const char = state.character;
      if (!char) return state;
      const itemBlacklist = (char.itemBlacklist ?? []).filter((e) => e.name !== action.itemName);
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

    case 'RESET_TALENTS': {
      const char = state.character;
      if (!char) return state;
      const cost = talentResetCost(char.talentResetCount);
      const hasPoints = Object.values(char.talentPoints ?? {}).some((p) => p > 0);
      if (char.gold < cost || !hasPoints) return state;
      return {
        ...state,
        character: {
          ...char,
          gold: char.gold - cost,
          talentPoints: {},
          talentResetCount: (char.talentResetCount ?? 0) + 1,
        },
        log: pushLog(state.log, `Talentos resetados por ${cost} gold.`),
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

    // Progresso offline: calculado FORA do reducer (precisa de Date.now() e da zona)
    // e despachado já pronto — xpGain/goldGain só chegam aqui depois de aplicar o
    // teto de 8h. Nunca dá item, só XP e gold (peso/mochila cheia não fariam sentido
    // pra algo que não aconteceu de verdade na tela).
    case 'APPLY_OFFLINE_PROGRESS': {
      const char = state.character;
      if (!char || (action.xpGain <= 0 && action.goldGain <= 0)) return state;
      const hoursLabel = action.hours >= 1 ? `${action.hours.toFixed(1)}h` : `${Math.round(action.hours * 60)}min`;
      const log0 = pushLog(
        state.log,
        `Enquanto você esteve fora (${hoursLabel} caçando em ${action.zoneName}): +${action.xpGain} XP, +${action.goldGain} gold.`,
      );
      const { xp, level, levelBatches, log, leveledUp } = applyXpGain(char, action.xpGain, log0);
      const updatedChar = {
        ...char,
        xp,
        level,
        levelBatches,
        gold: char.gold + action.goldGain,
        totalGoldEarned: char.totalGoldEarned + action.goldGain,
        totalXpEarned: char.totalXpEarned + action.xpGain,
      };
      const newStats = computeFinalStats(updatedChar);
      updatedChar.currentHealth = leveledUp ? newStats.health : Math.min(newStats.health, char.currentHealth);
      updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);
      return { ...state, character: updatedChar, log };
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
  const [offlineReport, setOfflineReport] = useState(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const offlineChecked = useRef(false);

  useEffect(() => {
    if (state.character) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
    }
  }, [state.character]);

  // Só roda uma vez, com o personagem exatamente como veio do localStorage ao abrir —
  // "estava caçando quando fechou" é o único caso que gera recompensa.
  useEffect(() => {
    if (offlineChecked.current) return;
    offlineChecked.current = true;
    const char = state.character;
    if (!char || !char.autoCombat || char.currentHealth <= 0) return;

    const elapsedMs = Math.min(Date.now() - (char.updatedAt || Date.now()), OFFLINE_CAP_MS);
    if (elapsedMs < OFFLINE_MIN_MS) return;

    const zone = ZONES.find((z) => z.id === char.zoneId) ?? ZONES[0];
    const hours = elapsedMs / 3600000;
    const xpGain = Math.round(zone.xpPerHour * hours);
    const goldGain = Math.round(zone.goldPerHour * hours);
    if (xpGain <= 0 && goldGain <= 0) return;

    dispatch({ type: 'APPLY_OFFLINE_PROGRESS', xpGain, goldGain, hours, zoneName: zone.name });
    setOfflineReport({ hours, xpGain, goldGain, zoneName: zone.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOfflineReport = useCallback(() => setOfflineReport(null), []);

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
  //
  // "initialSyncDone" existe pra corrigir uma corrida séria: sem ele, o efeito de
  // SALVAR (logo abaixo) podia disparar antes dessa busca terminar — e se a busca
  // demorasse mais que o debounce de salvar, o personagem VELHO deste aparelho subia
  // pra nuvem e sobrescrevia um progresso mais avançado feito em outro aparelho
  // (exatamente o que te fez "voltar" de nível). Agora salvar só é permitido depois
  // que essa comparação inicial terminar.
  useEffect(() => {
    if (!user) return;
    setInitialSyncDone(false);
    let cancelled = false;
    (async () => {
      const remote = await loadGameState(user.uid).catch(() => null);
      if (cancelled) return;
      if (remote && (remote.updatedAt ?? 0) > (state.character?.updatedAt ?? 0)) {
        dispatch({ type: 'LOAD_REMOTE_CHARACTER', character: remote });
      }
      setInitialSyncDone(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Salva na nuvem (debounced) toda vez que o personagem muda, sob o UID da conta
  // Google logada — é isso que faz o outro dispositivo puxar o progresso depois.
  // Só roda depois do initialSyncDone (ver comentário acima).
  useEffect(() => {
    if (!user || !state.character || !initialSyncDone) return;
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
  }, [user, state.character, initialSyncDone]);

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

  // Relógio próprio pra tentar conjurar as magias equipadas — roda mais rápido que o
  // cooldown de qualquer magia (a mais curta é 1.5s) só pra não deixar o cast atrasar
  // depois que o cooldown já liberou. O reducer já ignora se autoCastSpells tá desligado.
  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    const id = setInterval(() => dispatch({ type: 'SPELL_CAST' }), 500);
    return () => clearInterval(id);
  }, [state.autoCombat, hasCharacter, isDead]);

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
  const setAutoEat = useCallback((enabled) => dispatch({ type: 'SET_AUTO_EAT', enabled }), []);
  const setAutoPotion = useCallback((settings) => dispatch({ type: 'SET_AUTO_POTION', settings }), []);
  const consumeItem = useCallback((itemId) => dispatch({ type: 'CONSUME_ITEM', itemId }), []);
  const sellItem = useCallback((itemId, all) => dispatch({ type: 'SELL_ITEM', itemId, all }), []);
  const discardItem = useCallback((itemId) => dispatch({ type: 'DISCARD_ITEM', itemId }), []);
  const depositItem = useCallback((itemId, all) => dispatch({ type: 'DEPOSIT_ITEM', itemId, all }), []);
  const withdrawItem = useCallback((itemId, all) => dispatch({ type: 'WITHDRAW_ITEM', itemId, all }), []);
  const addToBlacklist = useCallback(
    (itemName, minRarity) => dispatch({ type: 'ADD_TO_BLACKLIST', itemName, minRarity }),
    [],
  );
  const removeFromBlacklist = useCallback((itemName) => dispatch({ type: 'REMOVE_FROM_BLACKLIST', itemName }), []);
  const equipItem = useCallback((itemId, targetSlot) => dispatch({ type: 'EQUIP_ITEM', itemId, targetSlot }), []);
  const unequipItem = useCallback((slot) => dispatch({ type: 'UNEQUIP_ITEM', slot }), []);
  const allocateStat = useCallback((stat) => dispatch({ type: 'ALLOCATE_STAT', stat }), []);
  const resetAttributes = useCallback(() => dispatch({ type: 'RESET_ATTRIBUTES' }), []);
  const resetTalents = useCallback(() => dispatch({ type: 'RESET_TALENTS' }), []);
  const investTalent = useCallback((talentId) => dispatch({ type: 'INVEST_TALENT', talentId }), []);
  const changeZone = useCallback((zoneId) => dispatch({ type: 'CHANGE_ZONE', zoneId }), []);
  const claimQuest = useCallback((questId) => dispatch({ type: 'CLAIM_QUEST', questId }), []);
  const buyItem = useCallback((merchantName, itemName) => dispatch({ type: 'BUY_ITEM', merchantName, itemName }), []);
  const sellToMerchant = useCallback(
    (merchantName, itemId) => dispatch({ type: 'SELL_TO_MERCHANT', merchantName, itemId }),
    [],
  );
  const learnSpell = useCallback((spellId) => dispatch({ type: 'LEARN_SPELL', spellId }), []);
  const equipSpell = useCallback((spellId, slotIndex) => dispatch({ type: 'EQUIP_SPELL', spellId, slotIndex }), []);
  const unequipSpell = useCallback((slotIndex) => dispatch({ type: 'UNEQUIP_SPELL', slotIndex }), []);
  const setAutoCastSpells = useCallback((enabled) => dispatch({ type: 'SET_AUTO_CAST_SPELLS', enabled }), []);
  const setSpellHealThreshold = useCallback(
    (spellId, pct) => dispatch({ type: 'SET_SPELL_HEAL_THRESHOLD', spellId, pct }),
    [],
  );

  return {
    character,
    monster: state.monster,
    log: state.log,
    autoCombat: state.autoCombat,
    setAutoCombat,
    setAutoEat,
    setAutoPotion,
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
    resetTalents,
    talentResetCost: state.character ? talentResetCost(state.character.talentResetCount) : TALENT_RESET_BASE_COST,
    talentPointsAvailable: state.character
      ? talentPointsForLevel(state.character.level) - spentTalentPoints(state.character.talentPoints)
      : 0,
    unspentPoints: state.character ? unspentPoints(state.character.levelBatches) : 0,
    weight,
    changeZone,
    claimQuest,
    buyItem,
    sellToMerchant,
    learnSpell,
    equipSpell,
    unequipSpell,
    setAutoCastSpells,
    setSpellHealThreshold,
    spellCooldowns: state.spellCooldowns,
    offlineReport,
    dismissOfflineReport,
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
