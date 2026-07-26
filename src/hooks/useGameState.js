import { useState, useEffect, useRef, useCallback } from 'react';
import { CLASSES, ZONES, STARTER_ITEMS, xpForNextLevel, rollLoot } from '../data/gameData';

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

const TURN_MS = 2000;
const STORAGE_KEY = 'apogea-idle-character';

function createCharacter(className) {
  const base = CLASSES[className].baseStats;
  return {
    class: className,
    level: 1,
    xp: 0,
    gold: 0,
    stats: { ...base },
    currentHealth: base.health,
    currentMana: base.mana,
    inventory: STARTER_ITEMS.map((i) => ({ ...i })),
    zoneId: ZONES[0].id,
  };
}

function pickMonster(zoneId) {
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const template = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  return { ...template, currentHealth: template.health, maxHealth: template.health };
}

export function useGameState() {
  const [character, setCharacter] = useState(() => {
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

  useEffect(() => {
    if (character) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    }
  }, [character]);

  useEffect(() => {
    if (character && !monster) {
      setMonster(pickMonster(character.zoneId));
    }
  }, [character, monster]);

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

  const characterRef = useRef(character);
  const monsterRef = useRef(monster);
  characterRef.current = character;
  monsterRef.current = monster;

  const runTurn = useCallback(() => {
    const char = characterRef.current;
    const currentMonster = monsterRef.current;
    if (!char || !currentMonster || char.currentHealth <= 0) return;

    const playerDamage = Math.max(1, char.stats.damage - currentMonster.armor / 2);
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
      let stats = { ...char.stats };
      let needed = xpForNextLevel(level);

      while (xp >= needed) {
        xp -= needed;
        level += 1;
        stats = {
          ...stats,
          health: stats.health + 10,
          mana: stats.mana + 5,
          damage: stats.damage + 2,
          armor: stats.armor + 1,
        };
        addLog(`Level up! Agora você é nível ${level}.`);
        needed = xpForNextLevel(level);
      }

      setCharacter({
        ...char,
        xp,
        level,
        stats,
        gold: char.gold + goldDrop,
        inventory: mergeLoot(char.inventory, itemDrops),
        currentHealth: Math.min(stats.health, char.currentHealth),
      });
      setMonster(pickMonster(char.zoneId));
      return;
    }

    const monsterDamage = Math.max(1, currentMonster.damage - char.stats.armor / 2);
    addLog(`${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.`);

    setCharacter({
      ...char,
      currentHealth: Math.max(0, char.currentHealth - monsterDamage),
    });
    setMonster({ ...currentMonster, currentHealth: monsterHealth });
  }, [addLog]);

  useEffect(() => {
    if (!autoCombat || !character || character.currentHealth <= 0) {
      clearInterval(turnRef.current);
      return;
    }

    const interval = TURN_MS / (character.stats.attackSpeed || 1);
    turnRef.current = setInterval(runTurn, interval);

    return () => clearInterval(turnRef.current);
  }, [autoCombat, character?.stats.attackSpeed, character?.currentHealth, runTurn]);

  useEffect(() => {
    if (character && character.currentHealth <= 0 && autoCombat) {
      setAutoCombat(false);
      addLog('Você foi derrotado! Combate automático interrompido.');
    }
  }, [character?.currentHealth, autoCombat, addLog]);

  const consumeItem = useCallback((itemId) => {
    setCharacter((char) => {
      if (!char) return char;
      const item = char.inventory.find((i) => i.id === itemId);
      if (!item || item.quantity <= 0) return char;

      let currentHealth = char.currentHealth;
      if (item.stats?.health) {
        currentHealth = Math.min(char.stats.health, currentHealth + item.stats.health);
        addLog(`Você usou ${item.name} e recuperou ${item.stats.health} de vida.`);
      }

      const inventory = char.inventory
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return { ...char, currentHealth, inventory };
    });
  }, [addLog]);

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
    changeZone,
    zones: ZONES,
  };
}
