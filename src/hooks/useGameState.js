import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

function pickMonster(zoneId) {
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const template = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  return { ...template, currentHealth: template.health, maxHealth: template.health };
}

export function useGameState() {
  const [rawCharacter, setCharacter] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [monster, setMonster] = useState(null);
  const [log, setLog] = useState([]);
  const [autoCombat, setAutoCombat] = useState(false);

  const turnRef = useRef(null);

  const addLog = useCallback((message) => {
    setLog((prev) => [{ message, id: Date.now() + Math.random() }, ...prev].slice(0, 50));
  }, []);

  const stats = useMemo(
    () => (rawCharacter ? computeFinalStats(rawCharacter) : null),
    [rawCharacter],
  );
  const character = rawCharacter ? { ...rawCharacter, stats } : null;

  useEffect(() => {
    if (rawCharacter) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rawCharacter));
    }
  }, [rawCharacter]);

  useEffect(() => {
    if (rawCharacter && !monster) {
      setMonster(pickMonster(rawCharacter.zoneId));
    }
  }, [rawCharacter, monster]);

  const createNewCharacter = useCallback((className) => {
    const newChar = createCharacter(className);
    setCharacter(newChar);
    setMonster(pickMonster(newChar.zoneId));
    setLog([]);
    addLog(`Personagem ${className} criado! Boa sorte na aventura.`);
  }, [addLog]);

  const resetCharacter = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCharacter(null);
    setMonster(null);
    setLog([]);
    setAutoCombat(false);
  }, []);

  const characterRef = useRef(rawCharacter);
  const monsterRef = useRef(monster);
  characterRef.current = rawCharacter;
  monsterRef.current = monster;

  const runTurn = useCallback(() => {
    const char = characterRef.current;
    const currentMonster = monsterRef.current;
    if (!char || !currentMonster || char.currentHealth <= 0) return;

    const charStats = computeFinalStats(char);
    const playerDamage = Math.max(1, charStats.damage - currentMonster.armor / 2);
    const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);
    addLog(`Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.`);

    if (monsterHealth <= 0) {
      const { gold: goldDrop, items: itemDrops } = rollLoot(currentMonster);
      addLog(`${currentMonster.name} derrotado! +${currentMonster.xp} XP.`);
      if (goldDrop > 0) addLog(`+${goldDrop} gold.`);
      for (const item of itemDrops) {
        addLog(`Você encontrou: ${item.name} x${item.quantity}.`);
      }

      let xp = char.xp + currentMonster.xp;
      let level = char.level;
      let levelBatches = char.levelBatches;
      let needed = xpForNextLevel(level);

      while (xp >= needed) {
        xp -= needed;
        level += 1;
        levelBatches = [...levelBatches, { remaining: POINTS_PER_LEVEL, spent: {} }];
        addLog(`Level up! Agora você é nível ${level}. +${POINTS_PER_LEVEL} pontos de atributo.`);
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

      setCharacter(updatedChar);
      setMonster(pickMonster(char.zoneId));
      return;
    }

    const monsterDamage = Math.max(1, currentMonster.damage - charStats.armor / 2);
    addLog(`${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`);

    setCharacter({
      ...char,
      currentHealth: Math.max(0, char.currentHealth - monsterDamage),
    });
    setMonster({ ...currentMonster, currentHealth: monsterHealth });
  }, [addLog]);

  useEffect(() => {
    if (!autoCombat || !rawCharacter || rawCharacter.currentHealth <= 0) {
      clearInterval(turnRef.current);
      return;
    }

    const interval = TURN_MS / (stats?.attackSpeed || 1);
    turnRef.current = setInterval(runTurn, interval);

    return () => clearInterval(turnRef.current);
  }, [autoCombat, stats?.attackSpeed, rawCharacter?.currentHealth, runTurn, rawCharacter]);

  useEffect(() => {
    if (rawCharacter && rawCharacter.currentHealth <= 0 && autoCombat) {
      setAutoCombat(false);
      addLog('Você foi derrotado! Combate automático interrompido.');
    }
  }, [rawCharacter?.currentHealth, autoCombat, addLog]);

  // Regen passivo de HP/MP (baseado em hpRegen/mpRegen, valor "por 10s") e
  // auto-consumo de comida do inventário quando a vida cai abaixo de 80% do máximo.
  // Roda o tempo todo, mesmo fora de combate automático.
  useEffect(() => {
    if (!rawCharacter || rawCharacter.currentHealth <= 0) return;

    const id = setInterval(() => {
      setCharacter((char) => {
        if (!char || char.currentHealth <= 0) return char;
        const s = computeFinalStats(char);
        const tickFactor = REGEN_TICK_MS / 10000;

        let currentHealth = Math.min(s.health, char.currentHealth + s.hpRegen * tickFactor);
        const currentMana = Math.min(s.mana, char.currentMana + s.mpRegen * tickFactor);
        let inventory = char.inventory;

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
            addLog(`Você comeu ${food.name} e recuperou ${food.stats.health} de vida.`);
          }
        }

        if (
          currentHealth === char.currentHealth &&
          currentMana === char.currentMana &&
          inventory === char.inventory
        ) {
          return char;
        }
        return { ...char, currentHealth, currentMana, inventory };
      });
    }, REGEN_TICK_MS);

    return () => clearInterval(id);
  }, [rawCharacter?.currentHealth, addLog]);

  const consumeItem = useCallback((itemId) => {
    setCharacter((char) => {
      if (!char) return char;
      const item = char.inventory.find((i) => i.id === itemId);
      if (!item || item.quantity <= 0) return char;

      const s = computeFinalStats(char);
      let currentHealth = char.currentHealth;
      let currentMana = char.currentMana;
      if (item.stats?.health) {
        currentHealth = Math.min(s.health, currentHealth + item.stats.health);
        addLog(`Você usou ${item.name} e recuperou ${item.stats.health} de vida.`);
      }
      if (item.stats?.mana) {
        currentMana = Math.min(s.mana, currentMana + item.stats.mana);
        addLog(`Você usou ${item.name} e recuperou ${item.stats.mana} de mana.`);
      }

      const inventory = char.inventory
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return { ...char, currentHealth, currentMana, inventory };
    });
  }, [addLog]);

  const equipItem = useCallback((itemId) => {
    setCharacter((char) => {
      if (!char) return char;
      const item = char.inventory.find((i) => i.id === itemId);
      if (!item || !item.slot) return char;

      const slot = item.slot;
      const previouslyEquipped = char.equipment[slot];

      let inventory = char.inventory
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      if (previouslyEquipped) {
        const idx = inventory.findIndex((i) => i.id === previouslyEquipped.id);
        inventory = idx >= 0
          ? inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
          : [...inventory, { ...previouslyEquipped, quantity: 1 }];
      }

      const equipment = { ...char.equipment, [slot]: { ...item, quantity: 1 } };
      addLog(`Você equipou ${item.name}.`);

      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);
      return newChar;
    });
  }, [addLog]);

  const unequipItem = useCallback((slot) => {
    setCharacter((char) => {
      if (!char) return char;
      const item = char.equipment[slot];
      if (!item) return char;

      const idx = char.inventory.findIndex((i) => i.id === item.id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
        : [...char.inventory, { ...item, quantity: 1 }];

      const equipment = { ...char.equipment, [slot]: null };
      addLog(`Você desequipou ${item.name}.`);

      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);
      return newChar;
    });
  }, [addLog]);

  const allocateStat = useCallback((stat) => {
    setCharacter((char) => {
      if (!char || !canAllocatePoint(char.levelBatches, stat)) return char;
      return { ...char, levelBatches: allocatePoint(char.levelBatches, stat) };
    });
  }, []);

  const changeZone = useCallback((zoneId) => {
    setCharacter((char) => (char ? { ...char, zoneId } : char));
    setMonster(pickMonster(zoneId));
  }, []);

  return {
    character,
    monster,
    log,
    autoCombat,
    setAutoCombat,
    createNewCharacter,
    resetCharacter,
    runTurn,
    consumeItem,
    equipItem,
    unequipItem,
    allocateStat,
    unspentPoints: rawCharacter ? unspentPoints(rawCharacter.levelBatches) : 0,
    changeZone,
    zones: ZONES,
  };
}
