import { applyTalentEffects, SHAPE_OF_WATER_MANA_CAP, SHAPE_OF_WATER_MAGIC_CAP } from './talents.js';
import { applySatietyBonus } from './satiety.js';

// Base REAL do Squire nível 1, extraída do código-fonte da calculadora da comunidade
// (paszqa/quickapogean, calc.html: const baseStats = {Health:[150,5], Mana:[15,5],
// Magic:[0,1], Damage:[5,1], Ability:[0,1], "Attack Speed":[10,1], "HP Regen":[2,1],
// "MP Regen":[1,1], Armor:[0,1], Defense:[0,1], Capacity:[225,25]}). O primeiro número
// é o valor no nível 1 (sem pontos); o segundo é POINT_RATES (ganho por ponto investido),
// que já bate exatamente com o que tínhamos estimado antes por outra via.
const BASE_SQUIRE_STATS = {
  health: 150,
  mana: 15,
  magic: 0,
  ability: 0,
  hpRegen: 2,
  mpRegen: 1,
  capacity: 225,
  attackSpeed: 10,
  armor: 0,
  defense: 0,
  damage: 5,
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

// Multiplicadores REAIS e completos, também extraídos do calc.html (const
// classMultipliers). São ligeiramente diferentes da tabela que você tinha passado
// antes (essa fonte tem Ability e Capacity, que faltavam, e corrige alguns valores:
// Knight Mana/Magic/MP Regen são 50% aqui, não 100%; Mage Attack Speed é 100%, não
// 75%; Rogue Health é 100%, não 120%). Fica valendo essa por vir do código da
// calculadora, mais completo.
export const CLASSES = {
  Squire: defineClass(
    'Squire',
    'Aprendiz sem vocação — todos os multiplicadores neutros (100%). Escolha uma profissão pagando 100 gold.',
    { health: 1, mana: 1, magic: 1, ability: 1, hpRegen: 1, mpRegen: 1, capacity: 1, attackSpeed: 1, armor: 1, defense: 1 },
  ),
  Knight: defineClass(
    'Knight',
    '+100% Health, +50% Armor/Defense/Capacity, +25% Ability/HP Regen — o tanque (-50% Mana/Magic/MP Regen).',
    { health: 2, mana: 0.5, magic: 0.5, ability: 1.25, hpRegen: 1.25, mpRegen: 0.5, capacity: 1.5, attackSpeed: 1, armor: 1.5, defense: 1.5 },
  ),
  Rogue: defineClass(
    'Rogue',
    '+50% Ability/Magic, +25% Mana/Attack Speed — ágil e versátil, sem penalidades.',
    { health: 1, mana: 1.25, magic: 1.5, ability: 1.5, hpRegen: 1, mpRegen: 1, capacity: 1, attackSpeed: 1.25, armor: 1, defense: 1 },
  ),
  Mage: defineClass(
    'Mage',
    '+100% Mana/Magic/MP Regen — poder arcano (-25% Health/Ability/Armor/Defense/HP Regen/Capacity).',
    { health: 0.75, mana: 2, magic: 2, ability: 0.75, hpRegen: 0.75, mpRegen: 2, capacity: 0.75, attackSpeed: 1, armor: 0.75, defense: 0.75 },
  ),
};

export const VOCATION_COST = 100;

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
  // O multiplicador de classe (ex: Knight +50% Armor/Defense, Mage +100% Mana/Magic/
  // MP Regen e -25% Health/Ability/Armor/Defense/HP Regen/Capacity) só era aplicado
  // sobre a base + pontos alocados — bônus e PENALIDADES de equipamento (a fonte real
  // de quase toda Armor/Defense/Regen do jogo) passavam direto, sem multiplicar. Isso
  // deixava boa parte da identidade de cada classe sem efeito nenhum na prática
  // (ex: Knight não ficava mais "tanque" nem vestindo armadura pesada). Corrigido:
  // cada stat de item passa pelo MESMO multiplicador da classe, positivo ou negativo,
  // igual já acontecia com os pontos — 'damage' fica de fora (nenhuma classe tem
  // multiplicador pra ele, sempre foi por design escalar via Ability/Magic, não class).
  const classMult = CLASSES[character.class]?.multipliers ?? {};
  const equippedItems = Object.values(character.equipment ?? {}).filter(Boolean);
  for (const item of equippedItems) {
    if (!item.stats) continue;
    for (const [key, val] of Object.entries(item.stats)) {
      const mult = classMult[key] ?? 1;
      stats[key] = Math.round(((stats[key] ?? 0) + val * mult) * 100) / 100;
    }
  }
  // Fórmula real da Staff (apogean.eu/lists/formulae): "WeaponDamage + Magic / 5" —
  // com cajado equipado, o Damage base do golpe ganha um bônus extra vindo do seu
  // Magic, além do bônus de Damage que o próprio item já dá. Antes isso não entrava
  // no cálculo: cajado se comportava exatamente igual a qualquer outra arma.
  if (character.equipment?.weapon?.category === 'staff') {
    stats.damage = Math.round((stats.damage + stats.magic / 5) * 100) / 100;
  }
  const talented = applyTalentEffects(stats, character);
  // Shape of Water (Luva): "sua Mana vira 25 e Magic vira 5" — trade-off real e pesado
  // do capstone (não é cap, é um valor FIXO, sobrescrevendo qualquer bônus de outro
  // lugar). Aplicado depois de tudo pra valer por cima de qualquer outro bônus.
  if (talented.shapeOfWaterActive) {
    talented.mana = SHAPE_OF_WATER_MANA_CAP;
    talented.magic = SHAPE_OF_WATER_MAGIC_CAP;
  }
  const withSatiety = applySatietyBonus(talented, character.satiety);
  // Piso de segurança: talentos com penalidade fixa de Dano (ex: Monster Candy, -99)
  // são pensados pra personagens de nível alto com Damage bem maior — em nível baixo
  // isso podia deixar o stat negativo e quebrar o range de dano exibido.
  withSatiety.damage = Math.max(1, withSatiety.damage);
  // Balanceamento nosso, não é fórmula real do jogo: o Mage tem -25% de Ability por
  // design de classe (é o "preço" de ganhar 2x Magic/Mana), então o ataque básico
  // dele — que normalmente escala com Ability — ficava sem graça nenhuma mesmo com
  // Magic alto, já que só o cajado (Magic/5) usava esse stat. A pedido do usuário,
  // pro Mage o ataque básico escala com Magic em vez de Ability.
  withSatiety.damageScalingStat = character.class === 'Mage' ? withSatiety.magic : withSatiety.ability;
  return withSatiety;
}

// Fórmula real de dano por golpe (também do calc.html): não é um número fixo, é um
// intervalo min-max. max = Damage × (1 + Fator×1.25/100); min = max/5; o "dano
// médio" usado pro DPS é a média dos dois (equivale a 60% do máximo). É por isso que
// a tela real mostra um range tipo "30.6-152.8" em vez de um valor só. O "Fator" é
// Ability pra todo mundo, EXCETO Mage, que usa Magic (ver computeFinalStats).
export function computeDamageRoll(stats) {
  const scalingStat = stats.damageScalingStat ?? stats.ability;
  const abilityFactor = 1 + (scalingStat * 1.25) / 100;
  const max = Math.round(stats.damage * abilityFactor * 100) / 100;
  const min = Math.round((max / 5) * 100) / 100;
  const avg = Math.round(((min + max) / 2) * 100) / 100;
  return { min, max, avg };
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
