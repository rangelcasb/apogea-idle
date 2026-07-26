export const CLASSES = {
  Warrior: {
    name: 'Warrior',
    description: 'Guerreiro resistente, especialista em dano físico e defesa.',
    baseStats: {
      health: 120,
      mana: 30,
      magic: 5,
      ability: 15,
      hpRegen: 3,
      mpRegen: 1,
      capacity: 60,
      attackSpeed: 1.0,
      armor: 15,
      damage: 12,
    },
  },
  Mage: {
    name: 'Mage',
    description: 'Conjurador frágil, mas devastador com magia.',
    baseStats: {
      health: 70,
      mana: 100,
      magic: 20,
      ability: 8,
      hpRegen: 1,
      mpRegen: 4,
      capacity: 30,
      attackSpeed: 0.9,
      armor: 5,
      damage: 6,
    },
  },
  Rogue: {
    name: 'Rogue',
    description: 'Ágil e furtivo, ataca rápido com dano crítico.',
    baseStats: {
      health: 90,
      mana: 50,
      magic: 8,
      ability: 18,
      hpRegen: 2,
      mpRegen: 2,
      capacity: 45,
      attackSpeed: 1.4,
      armor: 8,
      damage: 10,
    },
  },
  Ranger: {
    name: 'Ranger',
    description: 'Caçador equilibrado, especialista em ataques à distância.',
    baseStats: {
      health: 95,
      mana: 60,
      magic: 10,
      ability: 16,
      hpRegen: 2,
      mpRegen: 2,
      capacity: 50,
      attackSpeed: 1.2,
      armor: 10,
      damage: 11,
    },
  },
};

export const ZONES = [
  {
    id: 'meadow',
    name: 'Campina Tranquila',
    minLevel: 1,
    monsters: [
      { name: 'Slime Verde', health: 20, damage: 3, armor: 0, xp: 5, gold: 2 },
      { name: 'Rato Gigante', health: 25, damage: 4, armor: 1, xp: 6, gold: 3 },
    ],
  },
  {
    id: 'forest',
    name: 'Floresta Sombria',
    minLevel: 5,
    monsters: [
      { name: 'Lobo Selvagem', health: 45, damage: 7, armor: 2, xp: 12, gold: 6 },
      { name: 'Aranha Venenosa', health: 40, damage: 8, armor: 1, xp: 13, gold: 7 },
    ],
  },
  {
    id: 'ruins',
    name: 'Ruínas Antigas',
    minLevel: 12,
    monsters: [
      { name: 'Esqueleto Guerreiro', health: 80, damage: 12, armor: 5, xp: 25, gold: 15 },
      { name: 'Golem de Pedra', health: 120, damage: 10, armor: 12, xp: 30, gold: 18 },
    ],
  },
];

export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  MATERIAL: 'material',
};

export const STARTER_ITEMS = [
  {
    id: 'rusty-sword',
    name: 'Espada Enferrujada',
    type: ITEM_TYPES.WEAPON,
    stats: { damage: 3 },
    quantity: 1,
  },
  {
    id: 'health-potion',
    name: 'Poção de Vida',
    type: ITEM_TYPES.CONSUMABLE,
    stats: { health: 30 },
    quantity: 3,
  },
];

export function xpForNextLevel(level) {
  return Math.floor(50 * Math.pow(1.2, level - 1));
}
