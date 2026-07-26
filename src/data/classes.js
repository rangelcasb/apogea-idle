import { applyTalentEffects } from './talents.js';
import { applySatietyBonus } from './satiety.js';

const BASE_SQUIRE_STATS = {
  health: 100,
  mana: 60,
  magic: 10,
  ability: 12,
  hpRegen: 2,
  mpRegen: 2,
  // Recalibrado pra bater com a tela real enviada: personagem com 0 pontos em Capacity
  // + um Green Bag equipado (+6 real) tinha 225 de capacidade final -> base real 219.
  // Os pesos de item também são reais agora (itemdata.js), então precisavam da mesma escala.
  capacity: 219,
  // Escala real confirmada pela fórmula "Intervalo = 2s / (AttackSpeed/10)": em 10,
  // o intervalo é o padrão de 2s. Itens somam bônus diretos nessa mesma escala.
  attackSpeed: 10,
  armor: 10,
  // Defense é um stat real separado de Armor (fórmulas diferentes) — só vem de
  // equipamento nessa versão simplificada, sem base nem ponto/classe aplicados.
  defense: 0,
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
    '+2 Health, +1.5 Armor/Defense/Capacity — o tanque.',
    { health: 2.0, armor: 1.5, magic: 1.0, mana: 1.0, attackSpeed: 1.0, hpRegen: 1.25, mpRegen: 1.0 },
  ),
  Mage: defineClass(
    'Mage',
    '+2 Mana/Magic/MP Regen — poder arcano (frágil!).',
    { health: 0.75, armor: 0.75, magic: 2.0, mana: 2.0, attackSpeed: 0.75, hpRegen: 1.0, mpRegen: 2.0 },
  ),
  Rogue: defineClass(
    'Rogue',
    'Ágil e letal: 120% Health, 150% Magic, 125% Mana, 125% Attack Speed.',
    { health: 1.2, armor: 1.0, magic: 1.5, mana: 1.25, attackSpeed: 1.25, hpRegen: 1.0, mpRegen: 1.0, ability: 1.5 },
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
// (armor, damage, attackSpeed e outros vêm só da classe + equipamento, sem pontos)
// + efeito simplificado dos talentos investidos.
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
  const talented = applyTalentEffects(stats, character.talentPoints);
  return applySatietyBonus(talented, character.satiety);
}

// Fórmula real de XP, confirmada pelo usuário contra a tabela oficial (bate exato:
// nível 24 -> 69.618 pra próximo nível, nível 100 -> 121.054.601 acumulado, etc).
// XP acumulado pra alcançar o nível N = 50×(N-1)²×(2+(N-1)²/40), N>=2.
function totalXpForLevel(level) {
  if (level <= 1) return 0;
  const L = level - 1;
  return 50 * L * L * (2 + (L * L) / 40);
}

export function xpForNextLevel(level) {
  return Math.round(totalXpForLevel(level + 1) - totalXpForLevel(level));
}
