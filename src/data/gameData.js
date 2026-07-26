// Classes reais do Apogea: Knight, Mage, Rogue (fonte: apogea.fandom.com/wiki/Classes,
// resumido via Sportskeeda "All Archetypes in Apogea"). Os multiplicadores por classe
// (Defense, Health, HP Regen, Magic, Mana, MP Regen, Skill/Ability, Attack Speed) são reais;
// os valores-base (antes do multiplicador) não são documentados publicamente, então usamos
// uma base "Squire" neutra e aplicamos os percentuais reais sobre ela.
const BASE_SQUIRE_STATS = {
  health: 100,
  mana: 60,
  magic: 10,
  ability: 12,
  hpRegen: 2,
  mpRegen: 2,
  capacity: 40,
  attackSpeed: 1.0,
  armor: 10,
  damage: 10,
};

function applyMultipliers(mult) {
  const stats = { ...BASE_SQUIRE_STATS };
  for (const [key, factor] of Object.entries(mult)) {
    stats[key] = Math.round(stats[key] * factor * 100) / 100;
  }
  return stats;
}

export const CLASSES = {
  Knight: {
    name: 'Knight',
    description: 'Extremamente resistente: 200% de Vida, 150% de Defesa, 125% de HP Regen e a maior capacidade de carga.',
    baseStats: applyMultipliers({ health: 2.0, armor: 1.5, hpRegen: 1.25, capacity: 1.5 }),
  },
  Mage: {
    name: 'Mage',
    description: 'Conjurador: 200% de Magic, Mana e MP Regen.',
    baseStats: applyMultipliers({ magic: 2.0, mana: 2.0, mpRegen: 2.0 }),
  },
  Rogue: {
    name: 'Rogue',
    description: 'Ágil e letal: 150% de Skill e Magic, 125% de Mana e a maior velocidade de ataque (125%).',
    baseStats: applyMultipliers({ ability: 1.5, magic: 1.5, mana: 1.25, attackSpeed: 1.25 }),
  },
};

// Monstros reais do Apogea (nome, HP, Dano, Armadura, XP), extraídos do
// Monsters Browser (apogea-tools.lubien.dev/monsters). O site não expõe
// gold por monstro nem zona/localização — gold é estimado (30% do XP) e as
// "zonas" abaixo são apenas faixas de dificuldade criadas por HP, não os
// locais reais do mapa do jogo.
const MONSTER_TEMPLATES = [
  { name: 'Amphitere', health: 7500, damage: 150, armor: 75, xp: 6000 },
  { name: 'Alpha Wolf', health: 4500, damage: 14, armor: 14, xp: 1500 },
  { name: 'Ancient Snake', health: 450, damage: 25, armor: 33, xp: 375 },
  { name: 'Bandit', health: 85, damage: 15, armor: 9, xp: 30 },
  { name: 'Capozzi The Bandit', health: 2500, damage: 5, armor: 15, xp: 1000 },
  { name: 'Gaglio The Bandit', health: 4500, damage: 15, armor: 22, xp: 1000 },
  { name: 'Mateo The Bandit', health: 3500, damage: 10, armor: 15, xp: 1000 },
  { name: 'Banshee', health: 950, damage: 35, armor: 100, xp: 800 },
  { name: 'Bear', health: 300, damage: 25, armor: 30, xp: 130 },
  { name: 'The Blackhat', health: 7500, damage: 10, armor: 15, xp: 2500 },
  { name: 'Black Lamb', health: 25, damage: 0, armor: 1, xp: 3 },
  { name: 'Black Sheep', health: 35, damage: 0, armor: 2, xp: 6 },
  { name: 'Bone Eater', health: 425, damage: 38, armor: 38, xp: 235 },
  { name: 'Cave Spider', health: 100, damage: 15, armor: 8, xp: 50 },
  { name: 'Cave Troll', health: 1000, damage: 65, armor: 46, xp: 435 },
  { name: 'Conquest Crow', health: 650, damage: 40, armor: 45, xp: 400 },
  { name: 'Conquest Fowler', health: 300, damage: 25, armor: 22, xp: 170 },
  { name: 'Conquest Priestess', health: 400, damage: 25, armor: 35, xp: 330 },
  { name: 'Crazed Occultist', health: 200, damage: 25, armor: 11, xp: 190 },
  { name: 'Cube Of Doom', health: 375, damage: 25, armor: 36, xp: 200 },
  { name: 'Deadly Webcap', health: 3000, damage: 95, armor: 66, xp: 2250 },
  { name: 'Deer', health: 50, damage: 0, armor: 0, xp: 10 },
  { name: 'Devil Spider', health: 570, damage: 40, armor: 37, xp: 475 },
  { name: 'Digger', health: 255, damage: 30, armor: 27, xp: 155 },
  { name: 'Eye Of Pestilence', health: 1660, damage: 25, armor: 37, xp: 1250 },
  { name: 'The Gardener', health: 5000, damage: 10, armor: 15, xp: 2000 },
  { name: 'Giant Rat', health: 195, damage: 25, armor: 17, xp: 100 },
  { name: 'Goblin', health: 90, damage: 18, armor: 8, xp: 40 },
  { name: 'Great Lintwurm (Cave)', health: 15000, damage: 25, armor: 50, xp: 4000 },
  { name: 'Grizzly Bear', health: 700, damage: 35, armor: 40, xp: 300 },
  { name: 'Imp', health: 300, damage: 25, armor: 25, xp: 220 },
  { name: 'Pestilence Knight', health: 25000, damage: 180, armor: 85, xp: 15000 },
  { name: 'Lamb', health: 20, damage: 0, armor: 0, xp: 2 },
  { name: 'Lintwurm', health: 250, damage: 15, armor: 25, xp: 100 },
  { name: 'Minotaur', health: 870, damage: 57, armor: 47, xp: 570 },
  { name: 'Mireling', health: 175, damage: 20, armor: 20, xp: 65 },
  { name: 'Mireling Noble', health: 400, damage: 45, armor: 50, xp: 250 },
  { name: 'Monk', health: 275, damage: 30, armor: 23, xp: 140 },
  { name: 'Necromancer', health: 660, damage: 35, armor: 28, xp: 660 },
  { name: 'Obelisk', health: 5000, damage: 0, armor: 60, xp: 250 },
  { name: 'Occultist Acolyte', health: 155, damage: 10, armor: 17, xp: 85 },
  { name: 'Occultist Apprentice', health: 95, damage: 10, armor: 10, xp: 45 },
  { name: 'Occultist Enforcer', health: 295, damage: 35, armor: 32, xp: 210 },
  { name: 'Occultist Scholar', health: 415, damage: 15, armor: 20, xp: 390 },
  { name: 'Orc Berserker', health: 750, damage: 75, armor: 35, xp: 595 },
  { name: 'Orc General', health: 1750, damage: 75, armor: 57, xp: 995 },
  { name: 'Orc Infantry', health: 550, damage: 50, armor: 30, xp: 360 },
  { name: 'Orc Shaman', health: 585, damage: 35, armor: 27, xp: 625 },
  { name: 'Pestilence Plague', health: 1500, damage: 70, armor: 42, xp: 650 },
  { name: 'Pestilence Spawn', health: 285, damage: 30, armor: 25, xp: 175 },
  { name: 'Pestilence Stinger', health: 215, damage: 45, armor: 20, xp: 165 },
  { name: 'Plea', health: 155, damage: 17, armor: 14, xp: 90 },
  { name: 'Plea Occultist', health: 195, damage: 15, armor: 15, xp: 150 },
  { name: 'Tock', health: 250, damage: 5, armor: 5, xp: 25 },
  { name: 'Profaner', health: 1200, damage: 45, armor: 65, xp: 450 },
  { name: 'Rat', health: 35, damage: 5, armor: 3, xp: 10 },
  { name: 'Rat Shipper', health: 355, damage: 30, armor: 25, xp: 15 },
  { name: 'Rubellus', health: 205, damage: 10, armor: 18, xp: 145 },
  { name: 'Sheep', health: 30, damage: 0, armor: 1, xp: 4 },
  { name: 'Skeleton', health: 45, damage: 10, armor: 6, xp: 20 },
  { name: 'Great Lintwurm', health: 20000, damage: 25, armor: 50, xp: 3500 },
  { name: 'Sunskin', health: 375, damage: 15, armor: 28, xp: 185 },
  { name: 'Sunskin Enchanter', health: 550, damage: 20, armor: 30, xp: 425 },
  { name: 'Swamp Troll', health: 2350, damage: 85, armor: 70, xp: 1500 },
  { name: 'Terror Spider', health: 2800, damage: 85, armor: 65, xp: 2000 },
  { name: 'The Augur', health: 7500, damage: 10, armor: 20, xp: 2000 },
  { name: 'The Broodmother', health: 5000, damage: 10, armor: 18, xp: 1500 },
  { name: 'Tomb Diviner', health: 750, damage: 15, armor: 32, xp: 600 },
  { name: 'Tomb Guardian', health: 800, damage: 60, armor: 37, xp: 455 },
  { name: 'Tomb Worker', health: 1000, damage: 35, armor: 44, xp: 300 },
  { name: 'Tundra Rat', health: 375, damage: 35, armor: 28, xp: 250 },
  { name: 'Viscid Goblin', health: 195, damage: 25, armor: 19, xp: 125 },
  { name: 'Walking Boletus', health: 165, damage: 15, armor: 14, xp: 75 },
  { name: 'Wolf', health: 65, damage: 16, armor: 5, xp: 35 },
  { name: 'Young Amphitere', health: 1350, damage: 65, armor: 55, xp: 770 },
].map((m) => ({ ...m, gold: Math.max(1, Math.round(m.xp * 0.3)) }));

function buildZones() {
  const sorted = [...MONSTER_TEMPLATES].sort((a, b) => a.health - b.health);
  const tierSize = Math.ceil(sorted.length / 4);
  const tiers = [
    { id: 'lowlands', name: 'Terras Baixas', minLevel: 1 },
    { id: 'wilds', name: 'Terras Selvagens', minLevel: 8 },
    { id: 'depths', name: 'Profundezas', minLevel: 18 },
    { id: 'apex', name: 'Domínio dos Ápices', minLevel: 30 },
  ];
  return tiers.map((tier, i) => ({
    ...tier,
    monsters: sorted.slice(i * tierSize, (i + 1) * tierSize),
  }));
}

export const ZONES = buildZones();

export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  MATERIAL: 'material',
};

// Nomes e categorias reais do Items Browser (apogea-tools.lubien.dev/items, 210 itens
// no total). O browser não expõe os valores de stat de cada item, então os números
// de dano/armadura/vida abaixo são estimativas nossas para itens iniciais coerentes
// com a categoria real do item.
export const STARTER_ITEMS = [
  {
    id: 'bone-knife',
    name: 'Bone Knife',
    type: ITEM_TYPES.WEAPON,
    stats: { damage: 4 },
    quantity: 1,
  },
  {
    id: 'big-mana-potion',
    name: 'Big Mana Potion',
    type: ITEM_TYPES.CONSUMABLE,
    stats: { mana: 40 },
    quantity: 2,
  },
  {
    id: 'bread-loaf',
    name: 'Bread Loaf',
    type: ITEM_TYPES.CONSUMABLE,
    stats: { health: 20 },
    quantity: 3,
  },
];

export function xpForNextLevel(level) {
  return Math.floor(50 * Math.pow(1.2, level - 1));
}
