// Sistema de saciedade: comer uma comida ("de refeição", categorias reais RawFood/
// EdibleFood/CookedFood/SpecialFood/Drinks) dá um tempo de saciedade + o bônus passivo
// de regeneração daquele item ESPECÍFICO (HP Regen / MP Regen), agora com o valor REAL
// de cada item — vem de items.js (stats.hpRegen/stats.mpRegen), extraído da mesma fonte
// autoritativa do cliente do jogo usada pra árvore de talentos e pros itens de
// equipamento. Ingrediente cru (RawFood) e bebida (Drinks) não têm regen nenhum no jogo
// real — só pratos prontos (Edible/Cooked/SpecialFood) dão bônus, o que faz sentido.
//
// A DURAÇÃO da saciedade continua sendo nossa (o jogo real não documenta publicamente
// um sistema de saciedade assim) — pense nisso como o "tanque de comida" que esse jogo
// idle precisava pra comida ter função, só que agora com o efeito de verdade.
export const FOOD_CATEGORIES = new Set(['RawFood', 'EdibleFood', 'CookedFood', 'SpecialFood', 'Drinks']);

const SATIETY_MINUTES_BY_CATEGORY = {
  RawFood: 3,
  EdibleFood: 4,
  CookedFood: 6,
  SpecialFood: 8,
  Drinks: 5,
};

export function getSatietyMinutes(category) {
  return SATIETY_MINUTES_BY_CATEGORY[category] ?? 0;
}

// Come um item de comida: a duração sempre SOMA ao tempo restante (comer 2 alimentos
// diferentes seguidos dá a duração dos dois somada). O BÔNUS só troca se a saciedade
// atual já tiver zerado — se você já está saciado, o bônus de quem comeu primeiro
// continua valendo, o novo alimento só estende o tempo.
export function eatFood(currentSatiety, item) {
  const minutes = getSatietyMinutes(item?.category);
  if (!minutes) return currentSatiety;

  const addedMs = minutes * 60000;
  const stillSated = (currentSatiety?.remainingMs ?? 0) > 0;
  const bonus = item.stats?.hpRegen || item.stats?.mpRegen
    ? { hpRegen: item.stats.hpRegen ?? 0, mpRegen: item.stats.mpRegen ?? 0 }
    : null;

  return {
    remainingMs: (currentSatiety?.remainingMs ?? 0) + addedMs,
    bonus: stillSated ? currentSatiety.bonus : bonus,
    foodName: stillSated ? currentSatiety.foodName : null, // preenchido pelo chamador com o nome do item
  };
}

export function tickSatiety(currentSatiety, elapsedMs) {
  if (!currentSatiety || currentSatiety.remainingMs <= 0) return currentSatiety;
  const remainingMs = Math.max(0, currentSatiety.remainingMs - elapsedMs);
  return remainingMs > 0 ? { ...currentSatiety, remainingMs } : { remainingMs: 0, bonus: null, foodName: null };
}

export function applySatietyBonus(stats, satiety) {
  if (!satiety || satiety.remainingMs <= 0 || !satiety.bonus) return stats;
  const next = { ...stats };
  for (const [key, val] of Object.entries(satiety.bonus)) {
    next[key] = Math.round(((next[key] ?? 0) + val) * 100) / 100;
  }
  return next;
}
