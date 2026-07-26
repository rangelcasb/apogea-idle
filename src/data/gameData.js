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

// "Multiplicadores de classe aplicam sobre os pontos" — regra confirmada visualmente
// pelo usuário (tela do Character Planner de apogean.eu). Guardamos os multiplicadores
// separados do baseStats pra poder aplicá-los tanto na base quanto nos pontos alocados.
function defineClass(name, description, mult) {
  return { name, description, multipliers: mult, baseStats: applyMultipliers(mult) };
}

export const CLASSES = {
  Knight: defineClass(
    'Knight',
    'Extremamente resistente: 200% de Vida, 150% de Defesa, 125% de HP Regen e a maior capacidade de carga.',
    { health: 2.0, armor: 1.5, hpRegen: 1.25, capacity: 1.5 },
  ),
  Mage: defineClass(
    'Mage',
    'Conjurador: 200% de Magic, Mana e MP Regen.',
    { magic: 2.0, mana: 2.0, mpRegen: 2.0 },
  ),
  Rogue: defineClass(
    'Rogue',
    'Ágil e letal: 150% de Skill e Magic, 125% de Mana e a maior velocidade de ataque (125%).',
    { ability: 1.5, magic: 1.5, mana: 1.25, attackSpeed: 1.25 },
  ),
};

// Sistema de pontos de atributo por level — confirmado pela tela do Character Planner
// que o usuário enviou: total de pontos acumulados = (nível-1)*3 (bateu exatamente com
// o personagem "Hustan" nível 25 da imagem: 1+48+8+15 = 72 = (25-1)*3). No máximo 2
// pontos de cada "lote" de nível podem ir para o mesmo atributo — o resto tem que ir
// para outro atributo.
export const POINTS_PER_LEVEL = 3;
export const MAX_POINTS_PER_STAT_PER_LEVEL = 2;
export const ALLOCATABLE_STATS = ['health', 'mana', 'magic', 'ability', 'hpRegen', 'mpRegen', 'capacity'];

// Ganho por ponto investido, conforme os rótulos "+X/ponto" visíveis na tela enviada
// (Health "+5 HP/ponto", Ability "+1 dano min/máx/ponto", Capacity "+25 oz/ponto"...).
// Mana, Magic, HP/MP Regen não estavam totalmente legíveis na imagem — usamos valores
// simétricos/razoáveis para eles.
export const POINT_RATES = {
  health: 5,
  mana: 5,
  magic: 1,
  ability: 1,
  hpRegen: 1,
  mpRegen: 1,
  capacity: 25,
};

// Calcula os stats finais (base da classe + bônus dos pontos alocados, com o
// multiplicador de classe aplicado também sobre os pontos) para os 7 atributos
// alocáveis. Armor/Damage/AttackSpeed não são alocáveis por pontos — vêm da classe
// e do equipamento.
export function computeAllocatedStats(className, pointsSpent) {
  const classDef = CLASSES[className];
  const stats = { ...classDef.baseStats };
  for (const stat of ALLOCATABLE_STATS) {
    const points = pointsSpent?.[stat] ?? 0;
    const mult = classDef.multipliers[stat] ?? 1;
    stats[stat] = Math.round((stats[stat] + points * POINT_RATES[stat] * mult) * 100) / 100;
  }
  return stats;
}

// Soma os pontos já gastos em todos os "lotes" de nível (cada level-up gera um lote
// de 3 pontos com o limite de 2-por-atributo aplicado individualmente a ele).
export function sumSpentPoints(levelBatches) {
  const totals = {};
  for (const stat of ALLOCATABLE_STATS) totals[stat] = 0;
  for (const batch of levelBatches ?? []) {
    for (const [stat, n] of Object.entries(batch.spent ?? {})) {
      totals[stat] = (totals[stat] ?? 0) + n;
    }
  }
  return totals;
}

export function unspentPoints(levelBatches) {
  return (levelBatches ?? []).reduce((sum, b) => sum + b.remaining, 0);
}

export function canAllocatePoint(levelBatches, stat) {
  return (levelBatches ?? []).some(
    (b) => b.remaining > 0 && (b.spent[stat] ?? 0) < MAX_POINTS_PER_STAT_PER_LEVEL,
  );
}

// Aloca 1 ponto no atributo indicado, respeitando o limite de 2 pontos por atributo
// dentro do mesmo lote de nível. Retorna um novo array de lotes (imutável).
export function allocatePoint(levelBatches, stat) {
  const next = (levelBatches ?? []).map((b) => ({ remaining: b.remaining, spent: { ...b.spent } }));
  const idx = next.findIndex(
    (b) => b.remaining > 0 && (b.spent[stat] ?? 0) < MAX_POINTS_PER_STAT_PER_LEVEL,
  );
  if (idx === -1) return levelBatches;
  next[idx].spent[stat] = (next[idx].spent[stat] ?? 0) + 1;
  next[idx].remaining -= 1;
  return next;
}

// Stats finais de combate: base da classe + pontos alocados (health, mana, magic,
// ability, hpRegen, mpRegen, capacity) + bônus somado de todo equipamento vestido
// (armor, damage, attackSpeed e outros vêm só da classe + equipamento, sem pontos).
export function computeFinalStats(character) {
  const spent = sumSpentPoints(character.levelBatches);
  const stats = computeAllocatedStats(character.class, spent);
  const equippedItems = Object.values(character.equipment ?? {}).filter(Boolean);
  for (const item of equippedItems) {
    if (!item.stats) continue;
    for (const [key, val] of Object.entries(item.stats)) {
      stats[key] = Math.round(((stats[key] ?? 0) + val) * 100) / 100;
    }
  }
  return stats;
}

export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  MATERIAL: 'material',
};

// Slots de equipamento reais do jogo, conforme a tela do Character Planner enviada
// pelo usuário (Arma, Mão Secundária, Cabeça, Peitoral, Pernas, Botas, Munição,
// Pescoço, Anel, Mochila). Adicionamos "hands" (Mãos) porque a categoria real "Gloves"
// existe no Items Browser, mesmo não aparecendo nessa tela específica.
export const EQUIP_SLOTS = {
  weapon: 'Arma',
  offhand: 'Mão Secundária',
  head: 'Cabeça',
  chest: 'Peitoral',
  legs: 'Pernas',
  boots: 'Botas',
  hands: 'Mãos',
  neck: 'Pescoço',
  ring: 'Anel',
  backpack: 'Mochila',
  ammo: 'Munição',
};

// Chance de cada item de uma tabela de loot realmente cair quando o monstro morre,
// por raridade. As raridades (Common/Semi Rare/Rare/Very Rare/Ultra Rare) são reais,
// extraídas das páginas de cada monstro; as PORCENTAGENS de chance são nossas —
// o jogo original não publica esses números.
export const DROP_CHANCE = {
  Common: 0.6,
  'Semi Rare': 0.25,
  Rare: 0.08,
  'Very Rare': 0.02,
  'Ultra Rare': 0.005,
};

// Tabelas de loot reais por monstro (nome do item, quantidade, raridade), extraídas
// das páginas individuais do Monsters Browser (apogea-tools.lubien.dev/monsters/<slug>).
// "Obelisk" não tem loot na fonte original.
const LOOT_TABLES = {
  Amphitere: [
    { name: 'Gold', quantity: 100, rarity: 'Common' },
    { name: 'Red Breast', quantity: 1, rarity: 'Common' },
    { name: 'Dragonfruit', quantity: 2, rarity: 'Common' },
    { name: 'Brown Backpack', quantity: 10, rarity: 'Common' },
    { name: 'Lamb Meat', quantity: 1, rarity: 'Common' },
    { name: 'Hook Claw', quantity: 1, rarity: 'Common' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Scale Kilt', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Fireball', quantity: 1, rarity: 'Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Nightshade Kilt', quantity: 1, rarity: 'Rare' },
    { name: 'Steel Bracelet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Lineage Shield', quantity: 1, rarity: 'Very Rare' },
    { name: 'Greatsword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Royal Helmet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Royal Armor', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Great Axe', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Alpha Wolf': [
    { name: 'Small Bones', quantity: 4, rarity: 'Common' },
    { name: 'Hook Claw', quantity: 4, rarity: 'Common' },
    { name: 'Fur', quantity: 5, rarity: 'Common' },
    { name: 'Game Meat', quantity: 4, rarity: 'Common' },
    { name: 'Health Potion', quantity: 5, rarity: 'Common' },
    { name: 'Green Backpack', quantity: 1, rarity: 'Common' },
    { name: 'Broadsword', quantity: 1, rarity: 'Common' },
    { name: 'Battle Cloak', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leaf Blade', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Golden Torc', quantity: 1, rarity: 'Rare' },
  ],
  'Ancient Snake': [
    { name: 'Wood Twigs', quantity: 1, rarity: 'Common' },
    { name: 'Swamp Cod', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Cattail Flower', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Arrow', quantity: 5, rarity: 'Semi Rare' },
    { name: 'Old Gloves', quantity: 1, rarity: 'Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Precise Shot', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Mask', quantity: 1, rarity: 'Very Rare' },
  ],
  Bandit: [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Bread Piece', quantity: 1, rarity: 'Common' },
    { name: 'Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Cloth Vest', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Rare' },
    { name: 'Cloth Pants', quantity: 1, rarity: 'Rare' },
  ],
  'Capozzi The Bandit': [
    { name: 'Gold', quantity: 100, rarity: 'Common' },
    { name: 'Tofu Block', quantity: 2, rarity: 'Common' },
    { name: 'Wooden Cup', quantity: 1, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 3, rarity: 'Common' },
    { name: "Merchant's Bag", quantity: 1, rarity: 'Common' },
    { name: 'Green Book Taunt', quantity: 1, rarity: 'Common' },
    { name: 'Silver Dagger', quantity: 1, rarity: 'Common' },
    { name: 'Silver Mask', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Crystal Ring', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Evil Book Vampiric Bite', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Royal Dagger', quantity: 1, rarity: 'Rare' },
  ],
  'Gaglio The Bandit': [
    { name: 'Gold', quantity: 50, rarity: 'Common' },
    { name: 'Cooked Lamb', quantity: 2, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Common' },
    { name: 'Cloth Vest', quantity: 1, rarity: 'Common' },
    { name: 'Leather Cuisse', quantity: 1, rarity: 'Common' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Common' },
    { name: 'Old Backpack', quantity: 1, rarity: 'Common' },
    { name: 'Gambeson', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Rock Throw', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Rare' },
  ],
  'Mateo The Bandit': [
    { name: 'Gold', quantity: 15, rarity: 'Common' },
    { name: 'Bread Loaf', quantity: 2, rarity: 'Common' },
    { name: 'Health Potion', quantity: 3, rarity: 'Common' },
    { name: 'Ironsword', quantity: 1, rarity: 'Common' },
    { name: 'Buckler', quantity: 1, rarity: 'Common' },
    { name: 'Kettle Helmet', quantity: 1, rarity: 'Common' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Common' },
    { name: 'Red Book Fierce Thrust', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Chain Mail', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Epee', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Sailor Boots', quantity: 1, rarity: 'Rare' },
  ],
  Banshee: [
    { name: 'Gold', quantity: 25, rarity: 'Common' },
    { name: 'Rose', quantity: 1, rarity: 'Common' },
    { name: 'Nightshade', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Slow', quantity: 1, rarity: 'Rare' },
    { name: 'Apple Pie', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Gem', quantity: 1, rarity: 'Very Rare' },
    { name: 'Bachall', quantity: 1, rarity: 'Very Rare' },
    { name: 'Druid Cape', quantity: 1, rarity: 'Very Rare' },
  ],
  Bear: [
    { name: 'Wood Twigs', quantity: 2, rarity: 'Common' },
    { name: 'Game Meat', quantity: 2, rarity: 'Common' },
    { name: 'Fur', quantity: 2, rarity: 'Common' },
    { name: 'Rawhide', quantity: 2, rarity: 'Common' },
    { name: 'Blueberries', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Bascinet', quantity: 1, rarity: 'Rare' },
    { name: 'Scarf', quantity: 1, rarity: 'Very Rare' },
    { name: 'Strawberries', quantity: 1, rarity: 'Very Rare' },
  ],
  'The Blackhat': [
    { name: 'Gold', quantity: 150, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 5, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 5, rarity: 'Common' },
    { name: 'Bread Loaf', quantity: 3, rarity: 'Common' },
    { name: 'Red Book Energy Bolt', quantity: 1, rarity: 'Common' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Common' },
    { name: 'Tin Ingot', quantity: 3, rarity: 'Common' },
    { name: "Merchant's Bag", quantity: 1, rarity: 'Common' },
    { name: 'Epee', quantity: 1, rarity: 'Common' },
    { name: 'Golden Ring', quantity: 1, rarity: 'Common' },
    { name: 'Ruby Amulet', quantity: 1, rarity: 'Common' },
    { name: 'Evil Book Conjure Death', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Battle Cloak', quantity: 1, rarity: 'Rare' },
  ],
  'Black Lamb': [
    { name: 'Lamb Meat', quantity: 1, rarity: 'Common' },
    { name: 'Evil Book Dark Bind', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Black Sheep': [
    { name: 'Lamb Meat', quantity: 1, rarity: 'Common' },
    { name: 'Black Wool', quantity: 1, rarity: 'Common' },
    { name: 'Evil Book Conjure Death', quantity: 1, rarity: 'Very Rare' },
  ],
  'Bone Eater': [
    { name: 'Gold', quantity: 3, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Crowbar', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Snapper', quantity: 1, rarity: 'Rare' },
    { name: 'Garlic', quantity: 1, rarity: 'Rare' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Rare' },
    { name: 'Green Book Conjure Arrow', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Shield', quantity: 1, rarity: 'Very Rare' },
  ],
  'Cave Spider': [
    { name: 'Gold', quantity: 2, rarity: 'Common' },
    { name: 'Tofu Block', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Empty Pot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Slime Essence', quantity: 1, rarity: 'Rare' },
    { name: 'Cloth Pants', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Dagger', quantity: 1, rarity: 'Very Rare' },
  ],
  'Cave Troll': [
    { name: 'Gold', quantity: 12, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 1, rarity: 'Common' },
    { name: 'Lamb Meat', quantity: 2, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Common' },
    { name: 'Studded Shield', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Broadsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Old Backpack', quantity: 1, rarity: 'Rare' },
    { name: 'Gambeson', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Book Rock Throw', quantity: 1, rarity: 'Very Rare' },
  ],
  'Conquest Crow': [
    { name: 'Gold', quantity: 13, rarity: 'Common' },
    { name: 'Scale Kilt', quantity: 1, rarity: 'Rare' },
    { name: 'Orb', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Mask', quantity: 1, rarity: 'Rare' },
    { name: 'Longsword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Ancient Sword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Evil Book Dark Bind', quantity: 1, rarity: 'Very Rare' },
    { name: 'Quoki Headgear', quantity: 1, rarity: 'Very Rare' },
    { name: 'Dark Armor', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Conquest Fowler': [
    { name: 'Gold', quantity: 6, rarity: 'Common' },
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Rare' },
    { name: 'Sandworm Meal', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Precise Shot', quantity: 1, rarity: 'Rare' },
    { name: 'Shovel', quantity: 1, rarity: 'Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Bone Bow', quantity: 1, rarity: 'Very Rare' },
    { name: 'Quoki Headgear', quantity: 1, rarity: 'Very Rare' },
  ],
  'Conquest Priestess': [
    { name: 'Gold', quantity: 13, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Colocasia Seed', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Big Mana Potion', quantity: 1, rarity: 'Rare' },
    { name: 'Scarf', quantity: 1, rarity: 'Rare' },
    { name: 'Black Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Dagger', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Amulet', quantity: 1, rarity: 'Rare' },
    { name: 'Crystal Amulet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Blue Gem', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Quoki Shoes', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Crazed Occultist': [
    { name: 'Gold', quantity: 14, rarity: 'Common' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Common' },
    { name: 'Torch', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Iron Pan', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Health Potion', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Rare' },
    { name: 'Cooked Snapper', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Berserk', quantity: 1, rarity: 'Rare' },
    { name: 'Red Orb', quantity: 1, rarity: 'Very Rare' },
    { name: 'Brigandine Legs', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Red Book Fireball', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Cube Of Doom': [
    { name: 'Gold', quantity: 10, rarity: 'Common' },
    { name: 'Arrow', quantity: 3, rarity: 'Common' },
    { name: 'Slime Essence', quantity: 1, rarity: 'Common' },
    { name: 'Kettle Helmet', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Ironsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Wooden Bow', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Studded Shield', quantity: 1, rarity: 'Rare' },
    { name: 'Green Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Garnet Ring', quantity: 1, rarity: 'Very Rare' },
  ],
  'Deadly Webcap': [
    { name: 'White Mushroom', quantity: 3, rarity: 'Common' },
    { name: 'Wood Twigs', quantity: 2, rarity: 'Common' },
    { name: 'Web Cap Eye', quantity: 1, rarity: 'Common' },
    { name: 'Wooden Staff', quantity: 1, rarity: 'Common' },
    { name: 'Regen Ring', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Crying Arrow', quantity: 1, rarity: 'Rare' },
    { name: 'Crooked Vest', quantity: 1, rarity: 'Rare' },
    { name: 'Magician Shoes', quantity: 1, rarity: 'Very Rare' },
    { name: 'Druid Cape', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Nightshade Robe', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Blessed Amulet', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Deer: [
    { name: 'Game Meat', quantity: 1, rarity: 'Common' },
    { name: 'Fur', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Rawhide', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Very Rare' },
  ],
  'Devil Spider': [
    { name: 'Gold', quantity: 15, rarity: 'Common' },
    { name: 'Slime Essence', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Simple Garment', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Tin Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Conjure Fire', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Health Potion', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Cattail Flower', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Rare' },
    { name: 'Evil Book Vampiric Bite', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Rare' },
    { name: 'Zircon Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Orb', quantity: 1, rarity: 'Very Rare' },
  ],
  Digger: [
    { name: 'Gold', quantity: 9, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Shovel', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cuisse', quantity: 1, rarity: 'Rare' },
    { name: 'Crystal Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Ruby Amulet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Steel Ingot', quantity: 1, rarity: 'Very Rare' },
    { name: 'Diamond Ring', quantity: 1, rarity: 'Very Rare' },
  ],
  'Eye Of Pestilence': [
    { name: 'Gold', quantity: 45, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 3, rarity: 'Common' },
    { name: 'Big Mana Potion', quantity: 1, rarity: 'Common' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Bread Loaf', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Orb', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Ruby Amulet', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Book Mana Shield', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Book Magic Wall', quantity: 1, rarity: 'Rare' },
    { name: 'Crystal Staff', quantity: 1, rarity: 'Rare' },
    { name: "Merchant's Bag", quantity: 1, rarity: 'Rare' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Rare' },
    { name: 'Wizard Robe', quantity: 1, rarity: 'Very Rare' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Very Rare' },
    { name: 'Green Orb', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Unholy Staff', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Winged Boots', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'The Gardener': [
    { name: 'Gold', quantity: 100, rarity: 'Common' },
    { name: 'Health Potion', quantity: 6, rarity: 'Common' },
    { name: 'Small Skull', quantity: 5, rarity: 'Common' },
    { name: 'Torch', quantity: 3, rarity: 'Common' },
    { name: 'Spring Stew', quantity: 4, rarity: 'Common' },
    { name: 'Regen Ring', quantity: 1, rarity: 'Common' },
    { name: 'Blue Book Light Missile', quantity: 1, rarity: 'Common' },
    { name: 'Orb', quantity: 1, rarity: 'Common' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Common' },
    { name: 'Crystal Staff', quantity: 1, rarity: 'Common' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Common' },
    { name: 'Evil Book Dark Bind', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Talisman Pouch', quantity: 1, rarity: 'Rare' },
  ],
  'Giant Rat': [
    { name: 'Gold', quantity: 7, rarity: 'Common' },
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Cheese Slice', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Cloth Vest', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Spangenhelm', quantity: 1, rarity: 'Rare' },
    { name: 'Yellow Beauty', quantity: 1, rarity: 'Rare' },
  ],
  Goblin: [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Old Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Bascinet', quantity: 1, rarity: 'Rare' },
    { name: 'Rope', quantity: 1, rarity: 'Rare' },
  ],
  'Great Lintwurm (Cave)': [
    { name: 'Sandworm', quantity: 5, rarity: 'Common' },
    { name: 'Small Bones', quantity: 3, rarity: 'Common' },
    { name: 'Snapper', quantity: 3, rarity: 'Common' },
    { name: 'Tin Ingot', quantity: 3, rarity: 'Common' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Bone Bow', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Steel Ingot', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Red Book Quick Attack', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Vecan Axe', quantity: 1, rarity: 'Rare' },
    { name: 'Diamond Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Crooked Vest', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Legs', quantity: 1, rarity: 'Very Rare' },
  ],
  'Grizzly Bear': [
    { name: 'Gold', quantity: 10, rarity: 'Common' },
    { name: 'Game Meat', quantity: 1, rarity: 'Common' },
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Small Skull', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Spangenhelm', quantity: 1, rarity: 'Rare' },
    { name: 'Green Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Coif', quantity: 1, rarity: 'Rare' },
    { name: 'Crossbow', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Very Rare' },
    { name: 'Scale Armor', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Imp: [
    { name: 'Gold', quantity: 7, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Crystal Shard', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Snapper', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Crystal Amulet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Diamond Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Crystal Staff', quantity: 1, rarity: 'Very Rare' },
    { name: 'Longbow', quantity: 1, rarity: 'Very Rare' },
  ],
  'Pestilence Knight': [
    { name: 'Gold', quantity: 250, rarity: 'Common' },
    { name: 'Gold', quantity: 250, rarity: 'Common' },
    { name: 'Plagued Scale', quantity: 9, rarity: 'Common' },
    { name: 'Moon Ingot', quantity: 5, rarity: 'Common' },
    { name: 'Dark Legs', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Armor', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Helmet', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Armor', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Boots', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Shield', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Dagger', quantity: 1, rarity: 'Rare' },
    { name: 'Pestilence Sword', quantity: 1, rarity: 'Rare' },
    { name: 'Serpent Sword', quantity: 1, rarity: 'Rare' },
    { name: 'Onyx Legs', quantity: 1, rarity: 'Rare' },
  ],
  Lamb: [{ name: 'Lamb Meat', quantity: 1, rarity: 'Common' }],
  Lintwurm: [
    { name: 'Gold', quantity: 7, rarity: 'Common' },
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Snapper', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Sandworm', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Tin Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Chain Mail', quantity: 1, rarity: 'Very Rare' },
    { name: 'Brass Shield', quantity: 1, rarity: 'Very Rare' },
  ],
  Minotaur: [
    { name: 'Gold', quantity: 19, rarity: 'Common' },
    { name: 'Old Ring', quantity: 1, rarity: 'Common' },
    { name: 'Torch', quantity: 1, rarity: 'Common' },
    { name: 'Wheat', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Chain Mail', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Spangenhelm', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Battle Axe', quantity: 1, rarity: 'Rare' },
    { name: "Merchant's Bag", quantity: 1, rarity: 'Rare' },
    { name: 'Golden Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Rare' },
    { name: 'Tower Shield', quantity: 1, rarity: 'Very Rare' },
  ],
  Mireling: [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Swamp Cod', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Small Skull', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Torch', quantity: 1, rarity: 'Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Green Book Haste', quantity: 1, rarity: 'Very Rare' },
  ],
  'Mireling Noble': [
    { name: 'Gold', quantity: 15, rarity: 'Common' },
    { name: 'Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Torch', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Spicy Stew', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Green Book Conjure Arrow', quantity: 1, rarity: 'Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Scale Armor', quantity: 1, rarity: 'Very Rare' },
    { name: 'Battle Cloak', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Monk: [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Bread Piece', quantity: 2, rarity: 'Common' },
    { name: 'Apple', quantity: 1, rarity: 'Common' },
    { name: 'Cloth Pants', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Yellow Notebook', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brown Backpack', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Wooden Staff', quantity: 1, rarity: 'Rare' },
    { name: 'Old Gloves', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Healing Book', quantity: 1, rarity: 'Rare' },
    { name: 'Scarf', quantity: 1, rarity: 'Rare' },
  ],
  Necromancer: [
    { name: 'Gold', quantity: 30, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Common' },
    { name: 'Torch', quantity: 1, rarity: 'Common' },
    { name: 'Wooden Cup', quantity: 1, rarity: 'Common' },
    { name: 'Evil Book Conjure Death', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Orb', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Yellow Book Magic Growth', quantity: 1, rarity: 'Rare' },
    { name: 'Crystal Staff', quantity: 1, rarity: 'Rare' },
    { name: 'Skull Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Orb', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Winged Boots', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Bagnoff', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Obelisk: [],
  'Occultist Acolyte': [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 1, rarity: 'Common' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Gambeson', quantity: 1, rarity: 'Rare' },
    { name: 'Evil Book Dark Bind', quantity: 1, rarity: 'Rare' },
    { name: 'Wooden Staff', quantity: 2, rarity: 'Rare' },
    { name: 'Red Book Energy Bolt', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Amulet', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Very Rare' },
  ],
  'Occultist Apprentice': [
    { name: 'Gold', quantity: 4, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 1, rarity: 'Common' },
    { name: 'Blueberries', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Cloth Pants', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Silver Dagger', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Conjure Fire', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Ring', quantity: 1, rarity: 'Very Rare' },
  ],
  'Occultist Enforcer': [
    { name: 'Gold', quantity: 13, rarity: 'Common' },
    { name: 'Bread Loaf', quantity: 1, rarity: 'Common' },
    { name: 'Health Potion', quantity: 1, rarity: 'Common' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Ironsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Buckler', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Kettle Helmet', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Rare' },
    { name: 'Yellow Book Shield Block', quantity: 1, rarity: 'Rare' },
    { name: 'Chain Mail', quantity: 1, rarity: 'Rare' },
    { name: 'Epee', quantity: 1, rarity: 'Rare' },
  ],
  'Occultist Scholar': [
    { name: 'Gold', quantity: 16, rarity: 'Common' },
    { name: 'Tofu Block', quantity: 1, rarity: 'Common' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Square Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Evil Book Vampiric Bite', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Mask', quantity: 1, rarity: 'Rare' },
    { name: 'Crystal Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Book Lightning', quantity: 1, rarity: 'Very Rare' },
    { name: 'Wizard Hat', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Orb', quantity: 1, rarity: 'Very Rare' },
  ],
  'Orc Berserker': [
    { name: 'Gold', quantity: 14, rarity: 'Common' },
    { name: 'Cooked White Mushroom', quantity: 1, rarity: 'Common' },
    { name: 'Health Potion', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Berserk', quantity: 1, rarity: 'Rare' },
    { name: 'Gambeson', quantity: 10, rarity: 'Very Rare' },
    { name: 'Cutlass', quantity: 1, rarity: 'Very Rare' },
    { name: 'Brigandine Legs', quantity: 1, rarity: 'Very Rare' },
    { name: 'Velvet Pouch', quantity: 1, rarity: 'Very Rare' },
  ],
  'Orc General': [
    { name: 'Gold', quantity: 18, rarity: 'Common' },
    { name: 'Brown Backpack', quantity: 1, rarity: 'Common' },
    { name: 'Orange', quantity: 3, rarity: 'Common' },
    { name: 'Bread Loaf', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Meaty Stew', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Plated Helmet', quantity: 1, rarity: 'Rare' },
    { name: 'Longbow', quantity: 1, rarity: 'Rare' },
    { name: 'Steel Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Longsword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Blue Book Adjure', quantity: 1, rarity: 'Very Rare' },
    { name: 'Steelsword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Royal Legs', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Royal Dagger', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Orc Infantry': [
    { name: 'Gold', quantity: 6, rarity: 'Common' },
    { name: 'Bread Piece', quantity: 2, rarity: 'Common' },
    { name: 'Cloth Pants', quantity: 1, rarity: 'Common' },
    { name: 'Ironsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Rope', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Spangenhelm', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Breast', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brigandine Vest', quantity: 1, rarity: 'Very Rare' },
  ],
  'Orc Shaman': [
    { name: 'Gold', quantity: 12, rarity: 'Common' },
    { name: 'Apple', quantity: 2, rarity: 'Common' },
    { name: 'Small Bones', quantity: 1, rarity: 'Common' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Common' },
    { name: 'Boletus Piece', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Empty Pot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Wooden Bowl', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Black Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Very Rare' },
    { name: 'Nightshade Robe', quantity: 1, rarity: 'Very Rare' },
    { name: 'Stone Wand', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Pestilence Plague': [
    { name: 'Rat Tail', quantity: 1, rarity: 'Common' },
    { name: 'Health Potion', quantity: 1, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Common' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Rare' },
    { name: 'Old Gloves', quantity: 1, rarity: 'Rare' },
    { name: 'Gambeson', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Rare' },
    { name: 'Velvet Pouch', quantity: 1, rarity: 'Very Rare' },
    { name: 'Plated Shield', quantity: 1, rarity: 'Very Rare' },
  ],
  'Pestilence Spawn': [
    { name: 'Arrow', quantity: 6, rarity: 'Common' },
    { name: 'Blueberries', quantity: 2, rarity: 'Common' },
    { name: 'Bug Wings', quantity: 2, rarity: 'Common' },
    { name: 'Rice', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Regen Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Green Book Dash', quantity: 1, rarity: 'Very Rare' },
    { name: 'Green Orb', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Pestilence Stinger': [
    { name: 'Gold', quantity: 12, rarity: 'Common' },
    { name: 'Small Bones', quantity: 4, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Broadsword', quantity: 1, rarity: 'Rare' },
    { name: 'Spicy Stew', quantity: 1, rarity: 'Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Fierce Thrust', quantity: 1, rarity: 'Rare' },
    { name: 'Tin Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Pumpkin', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Coif', quantity: 1, rarity: 'Very Rare' },
    { name: 'Leather Gloves', quantity: 1, rarity: 'Very Rare' },
    { name: 'Crowbar', quantity: 1, rarity: 'Very Rare' },
  ],
  Plea: [
    { name: 'Gold', quantity: 6, rarity: 'Common' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 1, rarity: 'Common' },
    { name: 'Plea Toe', quantity: 2, rarity: 'Common' },
    { name: 'Torch', quantity: 1, rarity: 'Common' },
    { name: 'Fish Steak', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Red Book Thrash', quantity: 1, rarity: 'Rare' },
    { name: 'Broadsword', quantity: 1, rarity: 'Rare' },
    { name: 'Studded Shield', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Rare' },
  ],
  'Plea Occultist': [
    { name: 'Gold', quantity: 8, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 2, rarity: 'Common' },
    { name: 'Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Gray Backpack', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Conjure Fire', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Rare' },
    { name: 'Tin Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Evil Book Conjure Death', quantity: 1, rarity: 'Rare' },
  ],
  Tock: [
    { name: 'Gold', quantity: 6, rarity: 'Common' },
    { name: 'Tock Wig Piece', quantity: 1, rarity: 'Common' },
    { name: 'Plea Toe', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Old Axe', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Profaner: [
    { name: 'Gold', quantity: 25, rarity: 'Common' },
    { name: 'Torch', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Forsaken Cross', quantity: 1, rarity: 'Rare' },
    { name: 'Scarf', quantity: 1, rarity: 'Rare' },
    { name: 'Nightshade', quantity: 1, rarity: 'Rare' },
    { name: 'Rice Dish', quantity: 1, rarity: 'Rare' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Very Rare' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Very Rare' },
    { name: 'Velvet Pouch', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Book Slow', quantity: 1, rarity: 'Very Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Very Rare' },
  ],
  Rat: [
    { name: 'Gold', quantity: 2, rarity: 'Common' },
    { name: 'Cheese Slice', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Rare' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Very Rare' },
  ],
  'Rat Shipper': [
    { name: 'Gold', quantity: 3, rarity: 'Common' },
    { name: 'Simple Bag', quantity: 1, rarity: 'Common' },
    { name: 'Worn Paper', quantity: 2, rarity: 'Common' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Cloth Vest', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Torch', quantity: 1, rarity: 'Rare' },
    { name: 'Brown Backpack', quantity: 1, rarity: 'Rare' },
  ],
  Rubellus: [
    { name: 'Gold', quantity: 7, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Blue Gill', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Lantern', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Tomatoes', quantity: 2, rarity: 'Rare' },
    { name: 'Leather Boots', quantity: 2, rarity: 'Rare' },
    { name: 'Wooden Bow', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Ring', quantity: 1, rarity: 'Very Rare' },
    { name: 'Sailor Boots', quantity: 1, rarity: 'Ultra Rare' },
  ],
  Sheep: [
    { name: 'Wool', quantity: 1, rarity: 'Common' },
    { name: 'Lamb Meat', quantity: 1, rarity: 'Common' },
  ],
  Skeleton: [
    { name: 'Gold', quantity: 3, rarity: 'Common' },
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Torch', quantity: 1, rarity: 'Common' },
    { name: 'Ironsword', quantity: 1, rarity: 'Rare' },
    { name: 'Buckler', quantity: 1, rarity: 'Rare' },
    { name: 'Pumpkin', quantity: 1, rarity: 'Very Rare' },
  ],
  'Great Lintwurm': [
    { name: 'Sandworm', quantity: 5, rarity: 'Common' },
    { name: 'Small Bones', quantity: 3, rarity: 'Common' },
    { name: 'Snapper', quantity: 3, rarity: 'Common' },
    { name: 'Tin Ingot', quantity: 3, rarity: 'Common' },
    { name: 'Bone Knife', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Bone Bow', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Steel Ingot', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Red Book Quick Attack', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Diamond Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Vecan Axe', quantity: 1, rarity: 'Rare' },
    { name: 'Crooked Vest', quantity: 1, rarity: 'Rare' },
  ],
  Sunskin: [
    { name: 'Gold', quantity: 5, rarity: 'Common' },
    { name: 'Burlap Wool', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Sandworm', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Rice', quantity: 1, rarity: 'Rare' },
    { name: 'Old Gloves', quantity: 1, rarity: 'Rare' },
    { name: 'Old Backpack', quantity: 1, rarity: 'Very Rare' },
    { name: 'Black Bag', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Sunskin Enchanter': [
    { name: 'Gold', quantity: 18, rarity: 'Common' },
    { name: 'Rope', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Sandworm', quantity: 2, rarity: 'Semi Rare' },
    { name: 'Mana Potion', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Wooden Bowl', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Blue Book Heal', quantity: 1, rarity: 'Rare' },
    { name: 'Red Book Energy Bolt', quantity: 1, rarity: 'Rare' },
    { name: 'Burlap Hat', quantity: 1, rarity: 'Rare' },
    { name: 'Burlap Skirt', quantity: 1, rarity: 'Rare' },
    { name: 'Snake Orb', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Swamp Troll': [
    { name: 'Gold', quantity: 22, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 2, rarity: 'Common' },
    { name: 'Swamp Cod', quantity: 1, rarity: 'Common' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Green Book Conjure Arrow', quantity: 1, rarity: 'Rare' },
    { name: 'Steel Ingot', quantity: 1, rarity: 'Rare' },
    { name: 'Brigandine Vest', quantity: 1, rarity: 'Very Rare' },
    { name: 'Steelsword', quantity: 1, rarity: 'Very Rare' },
    { name: 'Plated Boots', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Tower Shield', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Terror Spider': [
    { name: 'Gold', quantity: 25, rarity: 'Common' },
    { name: 'Slime Essence', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Eggplant', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Rare' },
    { name: 'Plated Helmet', quantity: 1, rarity: 'Rare' },
    { name: 'Plated Legs', quantity: 1, rarity: 'Very Rare' },
    { name: 'Yellow Book Starlight', quantity: 1, rarity: 'Very Rare' },
    { name: 'Steel Bracelet', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Royal Armor', quantity: 1, rarity: 'Ultra Rare' },
    { name: 'Druid Hat', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'The Augur': [
    { name: 'Gold', quantity: 100, rarity: 'Common' },
    { name: 'Rawhide', quantity: 4, rarity: 'Common' },
    { name: 'Cooked Game Meat', quantity: 4, rarity: 'Common' },
    { name: 'Strawberries', quantity: 4, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 5, rarity: 'Common' },
    { name: 'Green Backpack', quantity: 1, rarity: 'Common' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Common' },
    { name: 'Vanguard Shield', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Battle Axe', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Battle Cloak', quantity: 1, rarity: 'Rare' },
    { name: 'Bachall', quantity: 1, rarity: 'Rare' },
  ],
  'The Broodmother': [
    { name: 'Rat Tail', quantity: 1, rarity: 'Common' },
    { name: 'Health Potion', quantity: 3, rarity: 'Common' },
    { name: 'Mana Potion', quantity: 3, rarity: 'Common' },
    { name: 'Plagued Scale', quantity: 1, rarity: 'Common' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Common' },
    { name: 'Old Gloves', quantity: 1, rarity: 'Common' },
    { name: 'Gambeson', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Dark Robe', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Dark Hood', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Velvet Pouch', quantity: 1, rarity: 'Rare' },
    { name: 'Plated Shield', quantity: 1, rarity: 'Rare' },
  ],
  'Tomb Diviner': [
    { name: 'Gold', quantity: 8, rarity: 'Common' },
    { name: 'Apple', quantity: 3, rarity: 'Common' },
    { name: 'Small Bones', quantity: 1, rarity: 'Common' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Common' },
    { name: 'Boletus Piece', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Empty Pot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Wooden Bowl', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cloak', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Black Bag', quantity: 1, rarity: 'Rare' },
    { name: 'Moon Ingot', quantity: 1, rarity: 'Very Rare' },
    { name: 'Nightshade Robe', quantity: 1, rarity: 'Very Rare' },
    { name: 'Stone Wand', quantity: 1, rarity: 'Ultra Rare' },
  ],
  'Tomb Guardian': [
    { name: 'Gold', quantity: 25, rarity: 'Common' },
    { name: 'Rock Core', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Plated Legs', quantity: 1, rarity: 'Very Rare' },
    { name: 'Plated Cuirass', quantity: 1, rarity: 'Very Rare' },
    { name: 'Plated Helmet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Longsword', quantity: 1, rarity: 'Very Rare' },
  ],
  'Tomb Worker': [
    { name: 'Gold', quantity: 15, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 1, rarity: 'Common' },
    { name: 'Lamb Meat', quantity: 2, rarity: 'Common' },
    { name: 'Small Skull', quantity: 1, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Common' },
    { name: 'Studded Shield', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Broadsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Iron Ingot', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Old Backpack', quantity: 1, rarity: 'Rare' },
    { name: 'Gambeson', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Collar', quantity: 1, rarity: 'Rare' },
    { name: 'Brass Legs', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Gloves', quantity: 1, rarity: 'Very Rare' },
    { name: 'Plated Helmet', quantity: 1, rarity: 'Very Rare' },
    { name: 'Brass Armor', quantity: 1, rarity: 'Very Rare' },
    { name: 'Red Book Rock Throw', quantity: 1, rarity: 'Very Rare' },
  ],
  'Tundra Rat': [
    { name: 'Gold', quantity: 8, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Common' },
    { name: 'Cheese Slice', quantity: 2, rarity: 'Common' },
    { name: 'Rat Tail', quantity: 1, rarity: 'Common' },
    { name: 'Crystal Shard', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Book Ice Berserk', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Gloves', quantity: 1, rarity: 'Very Rare' },
    { name: 'Crystal Staff', quantity: 1, rarity: 'Very Rare' },
  ],
  'Viscid Goblin': [
    { name: 'Gold', quantity: 7, rarity: 'Common' },
    { name: 'Ragged Cloth', quantity: 1, rarity: 'Common' },
    { name: 'Bug Wings', quantity: 1, rarity: 'Common' },
    { name: 'Ironsword', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Leather Cuisse', quantity: 1, rarity: 'Rare' },
    { name: 'Silver Amulet', quantity: 1, rarity: 'Rare' },
    { name: 'Nightshade', quantity: 1, rarity: 'Very Rare' },
    { name: "Merchant's Bag", quantity: 1, rarity: 'Very Rare' },
  ],
  'Walking Boletus': [
    { name: 'White Mushroom', quantity: 2, rarity: 'Common' },
    { name: 'Boletus Piece', quantity: 1, rarity: 'Common' },
    { name: 'Leather Boots', quantity: 1, rarity: 'Common' },
    { name: 'Golden Ring', quantity: 1, rarity: 'Very Rare' },
  ],
  Wolf: [
    { name: 'Small Bones', quantity: 2, rarity: 'Common' },
    { name: 'Fur', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Game Meat', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Hook Claw', quantity: 1, rarity: 'Rare' },
  ],
  'Young Amphitere': [
    { name: 'Gold', quantity: 15, rarity: 'Common' },
    { name: 'Blue Gill', quantity: 1, rarity: 'Common' },
    { name: 'Dragonfruit', quantity: 1, rarity: 'Common' },
    { name: 'Hook Claw', quantity: 1, rarity: 'Semi Rare' },
    { name: 'Scale Armor', quantity: 1, rarity: 'Rare' },
    { name: 'Regen Ring', quantity: 1, rarity: 'Rare' },
    { name: 'Leather Coif', quantity: 1, rarity: 'Rare' },
    { name: 'Epee', quantity: 1, rarity: 'Rare' },
    { name: 'Blue Book Windfall', quantity: 1, rarity: 'Rare' },
    { name: 'Plated Legs', quantity: 1, rarity: 'Rare' },
    { name: 'Plated Shield', quantity: 1, rarity: 'Rare' },
  ],
};

// Monstros reais do Apogea (nome, HP, Dano, Armadura, XP), extraídos do
// Monsters Browser (apogea-tools.lubien.dev/monsters). Zona/localização real
// não é exposta pela fonte, então as "zonas" abaixo são apenas faixas de
// dificuldade criadas por HP, não os locais reais do mapa do jogo.
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
].map((m) => ({ ...m, loot: LOOT_TABLES[m.name] ?? [] }));

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

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Categoria real de cada item, extraída do Items Browser (apogea-tools.lubien.dev/items,
// 210 itens). O browser expõe a categoria (ex: "Large Sword", "Light Chest", "Potions")
// mas NÃO expõe os valores de stat de cada item — isso é sempre estimado (ver
// estimateEquipStats/estimateConsumableStats abaixo).
const REAL_ITEM_CATEGORIES_LIST = [
  ['Ale Mug', 'Drinks'], ['Ancient Sword', 'Large Sword'], ['Apple', 'Food'], ['Apple Pie', 'Special Food'],
  ['Arrow', 'Arrows'], ['Bachall', 'Staff'], ['Bagnoff', 'Container'], ['Battle Axe', 'Axe'],
  ['Battle Cloak', 'Light Chest'], ['Big Empty Pot', 'Potions'], ['Big Mana Potion', 'Potions'],
  ['Black Bag', 'Container'], ['Black Wool', 'Cloth Products'], ['Blessed Amulet', 'Necklace'],
  ['Blue Backpack', 'Container'], ['Blue Gill', 'Raw Food'], ['Blue Spellbook: Heal', 'Book'],
  ['Blueberries', 'Food'], ['Boletus Piece', 'Swamp Products'], ['Bone Bow', 'Bow'], ['Bone Knife', 'Knife'],
  ['Brass Legs', 'Heavy Legs'], ['Brass Shield', 'Small Shield'], ['Bread Loaf', 'Raw Food'],
  ['Bread Piece', 'Edible Food'], ['Brigandine Legs', 'Light Legs'], ['Brigandine Vest', 'Light Chest'],
  ['Broadsword', 'Large Sword'], ['Brown Backpack', 'Container'], ['Buckler', 'Shield'],
  ['Bug Wings', 'Swamp Products'], ['Burlap Hat', 'Light Helmet'], ['Burlap Skirt', 'Light Legs'],
  ['Burlap Wool', 'Monster Products'], ['Cattail Flower', 'Flowers'], ['Chain Mail', 'Heavy Chest'],
  ['Cheese Slice', 'Edible Food'], ['Cheese Wheel', 'Raw Food'], ['Cloth Pants', 'Light Legs'],
  ['Cloth Vest', 'Light Armor'], ['Colocasia Seed', 'Flowers'], ['Cooked Game Meat', 'Cooked Food'],
  ['Cooked Lamb', 'Cooked Food'], ['Cooked Snapper', 'Cooked Food'], ['Cooked White Mushroom', 'Cooked Food'],
  ['Crooked Vest', 'Light Chest'], ['Crossbow', 'Bow'], ['Crowbar', 'Tools'], ['Crystal Amulet', 'Necklace'],
  ['Crystal Ring', 'Ring'], ['Crystal Shard', 'North Products'], ['Crystal Staff', 'Staff'], ['Cutlass', 'Sword'],
  ['Dark Armor', 'Heavy Armor'], ['Dark Hood', 'Light Helmet'], ['Dark Legs', 'Light Legs'],
  ['Dark Robe', 'Light Chest'], ['Diamond Ring', 'Ring'], ['Dragonfruit', 'Special Food'],
  ['Druid Cape', 'Light Chest'], ['Druid Hat', 'Light Helmet'], ['Eggplant', 'Edible Food'],
  ['Elvish Amanita', 'Special Food'], ['Empty Pot', 'Potions'], ['Epee', 'Sword'], ['Fish Steak', 'Edible Food'],
  ['Forsaken Cross', 'Holy Products'], ['Fur', 'North Products'], ['Gambeson', 'Light Armor'],
  ['Game Meat', 'Raw Food'], ['Garlic', 'Raw Food'], ['Garnet Ring', 'Ring'], ['Golden Ring', 'Ring'],
  ['Golden Torc', 'Currency'], ['Gray Backpack', 'Backpacks'], ['Great Axe', 'Large Axe'],
  ['Greatsword', 'Large Sword'], ['Green Backpack', 'Container'], ['Green Bag', 'Container'],
  ['Green Orb', 'Orb'], ['Grilled Cheese', 'Special Food'], ['Health Potion', 'Potions'],
  ['Hero Flower', 'Flowers'], ['Hook Claw', 'Monster Products'], ['Iron Ingot', 'Metal Products'],
  ['Iron Pan', 'Cooking Items'], ['Ironsword', 'Sword'], ['Kettle Helmet', 'Heavy Helmet'],
  ['Kings Nose', 'Flowers'], ['Knife', 'Knife'], ['Lamb Meat', 'Raw Food'], ['Lantern', 'Light Sources'],
  ['Leaf Blade', 'Sword'], ['Leather Bascinet', 'Light Helmet'], ['Leather Boots', 'Light Boots'],
  ['Leather Cloak', 'Light Chest'], ['Leather Coif', 'Light Helmet'], ['Leather Collar', 'Light Neck'],
  ['Leather Cuisse', 'Light Legs'], ['Leather Gloves', 'Gloves'], ['Lineage Shield', 'Small Shield'],
  ['Longbow', 'Bow'], ['Longsword', 'Large Sword'], ['Magician Shoes', 'Light Boots'], ['Mana Potion', 'Potions'],
  ['Meaty Stew', 'Special Food'], ["Merchant's Bag", 'Container'], ['Merchants Bag', 'Container'],
  ['Moon Ingot', 'Forge Products'], ['Nightshade', 'Flowers'], ['Nightshade Kilt', 'Light Legs'],
  ['Nightshade Robe', 'Light Chest'], ['Old Axe', 'Large Axe'], ['Old Backpack', 'Container'],
  ['Old Gloves', 'Gloves'], ['Old Ring', 'Plains Products'], ['Onion', 'Raw Food'], ['Onion Rings', 'Cooked Food'],
  ['Onyx Armor', 'Heavy Chest'], ['Onyx Boots', 'Heavy Boots'], ['Onyx Dagger', 'Dagger'],
  ['Onyx Helmet', 'Heavy Helmet'], ['Onyx Legs', 'Heavy Legs'], ['Onyx Ring', 'Ring'],
  ['Onyx Shield', 'Small Shield'], ['Orange', 'Edible Food'], ['Orb', 'Orb'], ['Pestilence Sword', 'Large Sword'],
  ['Plagued Scale', 'Swamp Products'], ['Plated Boots', 'Heavy Boots'], ['Plated Cuirass', 'Heavy Chest'],
  ['Plated Helmet', 'Heavy Helmet'], ['Plated Legs', 'Heavy Legs'], ['Plated Shield', 'Small Shield'],
  ['Plea Toe', 'Monster Products'], ['Pumpkin', 'Food'], ['Quoki Headgear', 'Light Mask'],
  ['Quoki Shoes', 'Light Boots'], ['Ragged Cloth', 'Cloth Products'], ['Rat Tail', 'Monster Products'],
  ['Rawhide', 'North Products'], ['Red Breast', 'Raw Food'], ['Red Orb', 'Orb'], ['Rice', 'Raw Food'],
  ['Rice Dish', 'Special Food'], ['Rock Core', 'Desert Products'], ['Rope', 'Tools'], ['Rose', 'Flowers'],
  ['Royal Armor', 'Heavy Chest'], ['Royal Dagger', 'Dagger'], ['Royal Helmet', 'Heavy Helmet'],
  ['Royal Legs', 'Heavy Legs'], ['Ruby Amulet', 'Necklace'], ['Rusty Sword', 'Sword'],
  ['Sailor Boots', 'Light Boots'], ['Sandworm', 'Special Food'], ['Sandworm Meal', 'Special Food'],
  ['Scale Armor', 'Heavy Chest'], ['Scale Kilt', 'Heavy Legs'], ['Scarf', 'Light Neck'],
  ['Serpent Sword', 'Sword'], ['Shovel', 'Tools'], ['Silver Amulet', 'Necklace'], ['Silver Dagger', 'Dagger'],
  ['Silver Mask', 'Light Mask'], ['Silver Ring', 'Ring'], ['Simple Bag', 'Container'],
  ['Simple Garment', 'Light Armor'], ['Skull Ring', 'Ring'], ['Slime Essence', 'Swamp Products'],
  ['Small Bones', 'MiscellaneousItems'], ['Small Skull', 'Grave Products'], ['Snake Orb', 'Orb'],
  ['Snapper', 'Raw Food'], ['Spangenhelm', 'Heavy Helmet'], ['Spicy Stew', 'Special Food'],
  ['Spring Stew', 'Special Food'], ['Square Bag', 'Container'], ['Steel Bracelet', 'Ring'],
  ['Steel Ingot', 'Forge Products'], ['Steelsword', 'Sword'], ['Stone Wand', 'Staff'],
  ['Strawberries', 'Special Food'], ['Studded Shield', 'Large Shield'], ['Swamp Cod', 'Raw Food'],
  ['Talisman Pouch', 'Container'], ['Tin Ingot', 'Metal Products'], ['Tofu Block', 'Edible Food'],
  ['Tomatoes', 'Edible Food'], ['Torch', 'Light Sources'], ['Tower Shield', 'Large Shield'],
  ['Unholy Staff', 'Staff'], ['Vanguard Shield', 'Small Shield'], ['Vecan Axe', 'Large Axe'],
  ['Velvet Pouch', 'Container'], ['Web Cap Eye', 'Desert Products'], ['Wheat', 'Raw Food'],
  ['White Mushroom', 'Edible Food'], ['Winged Boots', 'Light Boots'], ['Wizard Hat', 'Light Helmet'],
  ['Wizard Robe', 'Light Chest'], ['Wood Twigs', 'Plains Products'], ['Wooden Bow', 'Bow'],
  ['Wooden Bowl', 'Cooking Items'], ['Wooden Cup', 'Drinks'], ['Wooden Mug', 'Drinks'],
  ['Wooden Staff', 'Staff'], ['Wool', 'Cloth Products'], ['Worn Paper', 'Book Products'],
  ['Yellow Beauty', 'Flower Products'], ['Zircon Ring', 'Ring'],
];

const REAL_ITEM_CATEGORIES = Object.fromEntries(
  REAL_ITEM_CATEGORIES_LIST.map(([name, category]) => [slugify(name), category]),
);

// Categoria real -> slot de equipamento / tipo de item. Cobre todas as categorias
// observadas no Items Browser.
const CATEGORY_INFO = {
  'Large Sword': { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Sword: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Knife: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Dagger: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Bow: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Staff: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Axe: { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  'Large Axe': { slot: 'weapon', type: ITEM_TYPES.WEAPON },
  Shield: { slot: 'offhand', type: ITEM_TYPES.ARMOR },
  'Small Shield': { slot: 'offhand', type: ITEM_TYPES.ARMOR },
  'Large Shield': { slot: 'offhand', type: ITEM_TYPES.ARMOR },
  Orb: { slot: 'offhand', type: ITEM_TYPES.ARMOR },
  'Light Helmet': { slot: 'head', type: ITEM_TYPES.ARMOR },
  'Heavy Helmet': { slot: 'head', type: ITEM_TYPES.ARMOR },
  'Light Mask': { slot: 'head', type: ITEM_TYPES.ARMOR },
  'Light Chest': { slot: 'chest', type: ITEM_TYPES.ARMOR },
  'Heavy Chest': { slot: 'chest', type: ITEM_TYPES.ARMOR },
  'Light Armor': { slot: 'chest', type: ITEM_TYPES.ARMOR },
  'Heavy Armor': { slot: 'chest', type: ITEM_TYPES.ARMOR },
  'Light Legs': { slot: 'legs', type: ITEM_TYPES.ARMOR },
  'Heavy Legs': { slot: 'legs', type: ITEM_TYPES.ARMOR },
  'Light Boots': { slot: 'boots', type: ITEM_TYPES.ARMOR },
  'Heavy Boots': { slot: 'boots', type: ITEM_TYPES.ARMOR },
  Gloves: { slot: 'hands', type: ITEM_TYPES.ARMOR },
  Necklace: { slot: 'neck', type: ITEM_TYPES.ARMOR },
  'Light Neck': { slot: 'neck', type: ITEM_TYPES.ARMOR },
  Ring: { slot: 'ring', type: ITEM_TYPES.ARMOR },
  Container: { slot: 'backpack', type: ITEM_TYPES.ARMOR },
  Backpacks: { slot: 'backpack', type: ITEM_TYPES.ARMOR },
  Arrows: { slot: 'ammo', type: ITEM_TYPES.ARMOR },
  Drinks: { slot: null, type: ITEM_TYPES.CONSUMABLE },
  Food: { slot: null, type: ITEM_TYPES.CONSUMABLE },
  'Special Food': { slot: null, type: ITEM_TYPES.CONSUMABLE },
  Potions: { slot: null, type: ITEM_TYPES.CONSUMABLE },
  'Raw Food': { slot: null, type: ITEM_TYPES.CONSUMABLE },
  'Edible Food': { slot: null, type: ITEM_TYPES.CONSUMABLE },
  'Cooked Food': { slot: null, type: ITEM_TYPES.CONSUMABLE },
};

// Palavras-chave usadas quando um item não está na lista real (ex: itens de loot com
// nome levemente diferente do Items Browser). Fallback só, não é a fonte principal.
const WEAPON_WORDS = ['sword', 'axe', 'dagger', 'bow', 'staff', 'knife', 'wand', 'cutlass', 'epee', 'bachall'];
const ARMOR_WORDS = ['armor', 'legs', 'helmet', 'boots', 'shield', 'cloak', 'vest', 'robe', 'coif', 'bascinet', 'gambeson', 'kilt', 'cuisse', 'mask', 'hood', 'pants', 'mail', 'cuirass', 'bracelet'];
const CONSUMABLE_WORDS = ['potion', 'pie', 'stew', 'bread', 'meat', 'fish', 'cheese', 'apple', 'berries', 'orange', 'dish', 'rice', 'tomatoes', 'wheat', 'eggplant', 'pumpkin', 'mushroom', 'cod', 'gill', 'snapper', 'lamb'];

function guessItemInfo(name) {
  const n = name.toLowerCase();
  if (WEAPON_WORDS.some((w) => n.includes(w))) return { slot: 'weapon', type: ITEM_TYPES.WEAPON };
  if (ARMOR_WORDS.some((w) => n.includes(w))) return { slot: null, type: ITEM_TYPES.ARMOR };
  if (CONSUMABLE_WORDS.some((w) => n.includes(w))) return { slot: null, type: ITEM_TYPES.CONSUMABLE };
  return { slot: null, type: ITEM_TYPES.MATERIAL };
}

// Tiers estimados por palavra-chave no nome, usados só pra escalar o bônus estimado
// de equipamentos (o jogo real não expõe esses números publicamente).
const TIER_KEYWORDS = [
  { words: ['diamond', 'royal', 'pestilence', 'serpent', 'onyx', 'dark', 'wizard', 'crystal', 'great axe', 'greatsword'], tier: 5 },
  { words: ['plated', 'scale', 'steel', 'brigandine', 'chain'], tier: 4 },
  { words: ['brass', 'silver', 'studded', 'gambeson', 'sailor'], tier: 3 },
  { words: ['leather', 'iron', 'ironsword', 'burlap'], tier: 2 },
];

function estimateTier(name) {
  const n = name.toLowerCase();
  for (const group of TIER_KEYWORDS) {
    if (group.words.some((w) => n.includes(w))) return group.tier;
  }
  return 1;
}

// Bônus estimado de equipamento por slot/tier — não é dado real, é uma progressão
// razoável só pra dar efeito de jogo aos itens até termos números oficiais.
function estimateEquipStats(name, slot) {
  const tier = estimateTier(name);
  switch (slot) {
    case 'weapon':
      return { damage: 3 * tier };
    case 'offhand':
      return { armor: tier };
    case 'head':
    case 'chest':
    case 'legs':
    case 'boots':
    case 'hands':
      return { armor: Math.max(1, Math.round(tier * 0.8)) };
    case 'neck':
    case 'ring':
      return { magic: Math.ceil(tier / 2) };
    case 'backpack':
      return { capacity: 10 * tier };
    case 'ammo':
      return { damage: 1 };
    default:
      return {};
  }
}

// Efeito estimado de consumíveis (o site fonte não expõe valores de cura/mana).
function estimateConsumableStats(name) {
  const n = name.toLowerCase();
  if (n.includes('big mana')) return { mana: 40 };
  if (n.includes('mana')) return { mana: 20 };
  if (n.includes('health potion')) return { health: 30 };
  return { health: 12 };
}

// Monta a definição completa de um item de loot: categoria real (se conhecida),
// slot de equipamento, tipo e stats estimados.
export function getItemDefinition(name) {
  const category = REAL_ITEM_CATEGORIES[slugify(name)];
  const info = category ? CATEGORY_INFO[category] : guessItemInfo(name);
  const type = info?.type ?? ITEM_TYPES.MATERIAL;
  const slot = info?.slot ?? null;

  let stats;
  if (type === ITEM_TYPES.CONSUMABLE) stats = estimateConsumableStats(name);
  else if (slot) stats = estimateEquipStats(name, slot);

  return { type, slot, category: category ?? null, ...(stats ? { stats } : {}) };
}

// Sorteia o loot de um monstro derrotado. Cada item da tabela é sorteado de forma
// independente contra a chance da sua raridade (DROP_CHANCE). "Gold" vira ouro
// direto, os demais itens vão para o inventário.
export function rollLoot(monster) {
  let gold = 0;
  const items = [];
  for (const drop of monster.loot ?? []) {
    const chance = DROP_CHANCE[drop.rarity] ?? 0;
    if (Math.random() >= chance) continue;
    if (drop.name === 'Gold') {
      gold += drop.quantity;
      continue;
    }
    const def = getItemDefinition(drop.name);
    items.push({
      id: slugify(drop.name),
      name: drop.name,
      quantity: drop.quantity,
      ...def,
    });
  }
  return { gold, items };
}

export const STARTER_ITEMS = [
  {
    id: 'bone-knife',
    name: 'Bone Knife',
    quantity: 1,
    ...getItemDefinition('Bone Knife'),
  },
  {
    id: 'big-mana-potion',
    name: 'Big Mana Potion',
    quantity: 2,
    ...getItemDefinition('Big Mana Potion'),
  },
  {
    id: 'bread-loaf',
    name: 'Bread Loaf',
    quantity: 3,
    ...getItemDefinition('Bread Loaf'),
  },
];

export function xpForNextLevel(level) {
  return Math.floor(50 * Math.pow(1.2, level - 1));
}
