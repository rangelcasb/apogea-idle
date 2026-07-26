import { useReducer, useEffect, useMemo, useCallback } from 'react';
import {
  ZONES,
  STARTER_ITEMS,
  ITEM_TYPES,
  EQUIP_SLOTS,
  POINTS_PER_LEVEL,
  xpForNextLevel,
  rollLoot,
  computeFinalStats,
  canAllocatePoint,
  allocatePoint,
  unspentPoints,
} from '../data/gameData';

const TURN_MS = 2000;
const REGEN_TICK_MS = 2000;
const STORAGE_KEY = 'apogea-idle-character';

function mergeLoot(inventory, droppedItems) {
  const next = [...inventory];
  for (const drop of droppedItems) {
    const idx = next.findIndex((i) => i.id === drop.id);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + drop.quantity };
    } else {
      next.push({ ...drop });
    }
  }
  return next;
}

function emptyEquipment() {
  return Object.fromEntries(Object.keys(EQUIP_SLOTS).map((slot) => [slot, null]));
}

function createCharacter(className) {
  const raw = {
    class: className,
    level: 1,
    xp: 0,
    gold: 0,
    levelBatches: [],
    equipment: emptyEquipment(),
    inventory: STARTER_ITEMS.map((i) => ({ ...i })),
    currentHealth: 0,
    currentMana: 0,
    zoneId: ZONES[0].id,
  };
  const stats = computeFinalStats(raw);
  raw.currentHealth = stats.health;
  raw.currentMana = stats.mana;
  return raw;
}

// Personagens salvos antes do sistema de pontos/equipamento não têm esses campos —
// preenchemos com valores neutros pra não quebrar a tela ao carregar um save antigo.
function migrateCharacter(char) {
  if (!char) return char;
  return {
    ...char,
    levelBatches: char.levelBatches ?? [],
    equipment: char.equipment ?? emptyEquipment(),
    currentMana: char.currentMana ?? 0,
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
      const character = createCharacter(action.className);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `Personagem ${action.className} criado! Boa sorte na aventura.`),
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
      const playerDamage = Math.max(1, charStats.damage - currentMonster.armor / 2);
      const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);
      let log = pushLog(state.log, `Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.`);

      if (monsterHealth <= 0) {
        const { gold: goldDrop, items: itemDrops } = rollLoot(currentMonster);
        log = pushLog(log, `${currentMonster.name} derrotado! +${currentMonster.xp} XP.`);
        if (goldDrop > 0) log = pushLog(log, `+${goldDrop} gold.`);
        for (const item of itemDrops) {
          log = pushLog(log, `Você encontrou: ${item.name} x${item.quantity}.`);
        }

        let xp = char.xp + currentMonster.xp;
        let level = char.level;
        let levelBatches = char.levelBatches;
        let needed = xpForNextLevel(level);
        while (xp >= needed) {
          xp -= needed;
          level += 1;
          levelBatches = [...levelBatches, { remaining: POINTS_PER_LEVEL, spent: {} }];
          log = pushLog(log, `Level up! Agora você é nível ${level}. +${POINTS_PER_LEVEL} pontos de atributo.`);
          needed = xpForNextLevel(level);
        }

        const updatedChar = {
          ...char,
          xp,
          level,
          levelBatches,
          gold: char.gold + goldDrop,
          inventory: mergeLoot(char.inventory, itemDrops),
        };
        const newStats = computeFinalStats(updatedChar);
        updatedChar.currentHealth = Math.min(newStats.health, char.currentHealth);
        updatedChar.currentMana = Math.min(newStats.mana, char.currentMana);

        return { ...state, character: updatedChar, monster: pickMonster(char.zoneId), log };
      }

      const monsterDamage = Math.max(1, currentMonster.damage - charStats.armor / 2);
      log = pushLog(log, `${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`);
      const newHealth = Math.max(0, char.currentHealth - monsterDamage);

      let autoCombat = state.autoCombat;
      if (newHealth <= 0 && autoCombat) {
        autoCombat = false;
        log = pushLog(log, 'Você foi derrotado! Combate automático interrompido.');
      }

      return {
        ...state,
        character: { ...char, currentHealth: newHealth },
        monster: { ...currentMonster, currentHealth: monsterHealth },
        log,
        autoCombat,
      };
    }

    case 'REGEN_TICK': {
      const char = state.character;
      if (!char || char.currentHealth <= 0) return state;
      const s = computeFinalStats(char);
      const tickFactor = REGEN_TICK_MS / 10000;

      let currentHealth = Math.min(s.health, char.currentHealth + s.hpRegen * tickFactor);
      const currentMana = Math.min(s.mana, char.currentMana + s.mpRegen * tickFactor);
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

      if (currentHealth === char.currentHealth && currentMana === char.currentMana && inventory === char.inventory) {
        return state;
      }
      return { ...state, character: { ...char, currentHealth, currentMana, inventory }, log };
    }

    case 'CONSUME_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const s = computeFinalStats(char);
      let currentHealth = char.currentHealth;
      let currentMana = char.currentMana;
      let log = state.log;
      if (item.stats?.health) {
        currentHealth = Math.min(s.health, currentHealth + item.stats.health);
        log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.health} de vida.`);
      }
      if (item.stats?.mana) {
        currentMana = Math.min(s.mana, currentMana + item.stats.mana);
        log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.mana} de mana.`);
      }

      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return { ...state, character: { ...char, currentHealth, currentMana, inventory }, log };
    }

    case 'EQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || !item.slot) return state;

      const slot = item.slot;
      const previouslyEquipped = char.equipment[slot];

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
    const interval = TURN_MS / (attackSpeed || 1);
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

  const createNewCharacter = useCallback((className) => dispatch({ type: 'CREATE_CHARACTER', className }), []);
  const resetCharacter = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET' });
  }, []);
  const setAutoCombat = useCallback((valueOrFn) => dispatch({ type: 'SET_AUTO_COMBAT', valueOrFn }), []);
  const consumeItem = useCallback((itemId) => dispatch({ type: 'CONSUME_ITEM', itemId }), []);
  const equipItem = useCallback((itemId) => dispatch({ type: 'EQUIP_ITEM', itemId }), []);
  const unequipItem = useCallback((slot) => dispatch({ type: 'UNEQUIP_ITEM', slot }), []);
  const allocateStat = useCallback((stat) => dispatch({ type: 'ALLOCATE_STAT', stat }), []);
  const changeZone = useCallback((zoneId) => dispatch({ type: 'CHANGE_ZONE', zoneId }), []);

  return {
    character,
    monster: state.monster,
    log: state.log,
    autoCombat: state.autoCombat,
    setAutoCombat,
    createNewCharacter,
    resetCharacter,
    consumeItem,
    equipItem,
    unequipItem,
    allocateStat,
    unspentPoints: state.character ? unspentPoints(state.character.levelBatches) : 0,
    changeZone,
    zones: ZONES,
  };
}
