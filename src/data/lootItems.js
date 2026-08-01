import { REAL_ITEMS } from './items.js';
import { ITEM_TYPES } from './equipment.js';
import { DROP_CHANCE } from './lootTables.js';
import { FOOD_CATEGORIES } from './satiety.js';

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const REAL_ITEMS_BY_NAME = Object.fromEntries(REAL_ITEMS.map((it) => [it.name, it]));

// Raridade de INSTÂNCIA do item (common/uncommon/rare/epic/legendary — diferente da
// raridade de DROP do monstro, que já define a CHANCE do item cair). Cada raridade de
// instância tem stats reais diferentes (ver items.js). As probabilidades abaixo são
// nossas — o jogo real não publica a chance de cada tier de qualidade.
const QUALITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

function rollQualityVariant(variants) {
  const available = variants.filter((v) => QUALITY_WEIGHTS[v.rarity] != null);
  const pool = available.length ? available : variants;
  const total = pool.reduce((sum, v) => sum + (QUALITY_WEIGHTS[v.rarity] ?? 1), 0);
  let roll = Math.random() * total;
  for (const v of pool) {
    roll -= QUALITY_WEIGHTS[v.rarity] ?? 1;
    if (roll <= 0) return v;
  }
  return pool[0];
}

function typeFromSlot(slot, hasConsumable, category) {
  if (slot === 'weapon') return ITEM_TYPES.WEAPON;
  if (slot) return ITEM_TYPES.ARMOR;
  // Itens de comida "de refeição" (RawFood/EdibleFood/CookedFood/SpecialFood/Drinks)
  // não têm cura instantânea nos dados reais, mas viram consumível mesmo assim —
  // comer dá saciedade (ver satiety.js) em vez de curar na hora.
  if (hasConsumable || FOOD_CATEGORIES.has(category)) return ITEM_TYPES.CONSUMABLE;
  return ITEM_TYPES.MATERIAL;
}

// Nomes de item nas tabelas de loot dos monstros (extraídas das páginas de bestiário)
// às vezes usam grafia levemente diferente da base real de itens (extraída do
// itemdata.js). Resolve os casos mais comuns antes de desistir e cair no genérico.
const ITEM_NAME_ALIASES = {
  "Merchant's Bag": 'Merchants Bag',
  'Web Cap Eye': 'Webcap Eye',
  'Brass Armor': 'Brass Plate',
  'Regen Ring': 'Regeneration Ring',
  'Blue Healing Book': 'Blue Spellbook: Heal',
};
const SPELLBOOK_COLOR_RE = /^(Red|Blue|Green|Evil|Yellow) Book (.+)$/;

export function resolveRealItemName(name) {
  if (REAL_ITEMS_BY_NAME[name]) return name;
  if (ITEM_NAME_ALIASES[name] && REAL_ITEMS_BY_NAME[ITEM_NAME_ALIASES[name]]) return ITEM_NAME_ALIASES[name];
  const m = SPELLBOOK_COLOR_RE.exec(name);
  if (m) {
    const asSpellbook = `${m[1]} Spellbook: ${m[2].replace(/\s+/g, '')}`;
    if (REAL_ITEMS_BY_NAME[asSpellbook]) return asSpellbook;
  }
  return name;
}

function buildItemFromVariant(real, variant) {
  const type = typeFromSlot(real.slot, !!variant.consumable, real.category);
  return {
    type,
    slot: real.slot,
    category: real.category,
    weight: variant.weight,
    sellPrice: variant.sellPrice,
    rarity: variant.rarity,
    ...(variant.equipSize ? { equipSize: variant.equipSize } : {}),
    ...(variant.stats ? { stats: variant.stats } : {}),
    ...(variant.consumable ? { stats: variant.consumable } : {}),
  };
}

const GENERIC_MATERIAL = { type: ITEM_TYPES.MATERIAL, slot: null, category: null, weight: 5, sellPrice: 1, rarity: 'common' };

// Monta a definição completa de um item de loot a partir dos dados REAIS (items.js):
// sorteia a raridade de instância (common é a mais comum) e devolve slot, tipo, peso,
// stats de combate ou efeito de consumível — tudo real, exceto sellPrice e as
// probabilidades de raridade de instância (QUALITY_WEIGHTS), que são nossas.
export function getItemDefinition(name) {
  const real = REAL_ITEMS_BY_NAME[resolveRealItemName(name)];
  if (!real) return GENERIC_MATERIAL;
  return buildItemFromVariant(real, rollQualityVariant(real.variants));
}

// Item comprado de um mercador: sempre a variante "common" (uma loja vende um item
// específico, não sorteia raridade como um drop de monstro).
export function getShopItemDefinition(name) {
  const real = REAL_ITEMS_BY_NAME[resolveRealItemName(name)];
  if (!real) return GENERIC_MATERIAL;
  const commonVariant = real.variants.find((v) => v.rarity === 'common') ?? real.variants[0];
  return buildItemFromVariant(real, commonVariant);
}

// Sorteia o loot de um monstro derrotado. Cada item da tabela é sorteado de forma
// independente contra a chance da sua raridade DE DROP (DROP_CHANCE). "Gold" vira ouro
// direto; os demais itens ganham também uma raridade DE INSTÂNCIA real (ver acima).
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
    // As tabelas de loot dos monstros usam grafia antiga pra alguns itens (ex: "Evil
    // Book Dark Bind" em vez de "Evil Spellbook: DarkBind") — getItemDefinition já
    // resolve isso pra achar os stats certos, mas o item tem que NASCER com o nome
    // RESOLVIDO, senão tudo que depende do nome exato (aprender magia, ícone) quebra.
    const resolvedName = resolveRealItemName(drop.name);
    const def = getItemDefinition(drop.name);
    items.push({
      id: slugify(resolvedName) + '-' + def.rarity,
      name: resolvedName,
      quantity: drop.quantity,
      ...def,
    });
  }
  return { gold, items };
}



function starterItem(name, quantity) {
  const resolvedName = resolveRealItemName(name);
  const def = getItemDefinition(name);
  return { id: `${slugify(resolvedName)}-${def.rarity}`, name: resolvedName, quantity, ...def };
}

export const STARTER_ITEMS = [
  starterItem('Knife', 1),
  starterItem('Health Potion', 3),
  starterItem('Mana Potion', 2),
];
