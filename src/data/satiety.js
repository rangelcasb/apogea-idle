// Sistema de saciedade: comidas "de refeição" (categorias reais RawFood/EdibleFood/
// CookedFood/SpecialFood/Drinks) não têm efeito de cura instantânea nos dados reais
// (itemdata.js) — a maioria são ingredientes ou pratos sem hp/mana. Em vez de ficarem
// inúteis, cada uma dá um tempo de saciedade + um bônus passivo enquanto durar.
//
// Duração (minutos) e bônus por categoria são NOSSOS, o jogo real não documenta um
// sistema de saciedade assim publicamente — pense nisso como uma mecânica própria
// pra comida ter função no jogo idle.
export const FOOD_CATEGORIES = new Set(['RawFood', 'EdibleFood', 'CookedFood', 'SpecialFood', 'Drinks']);

const SATIETY_BY_CATEGORY = {
  RawFood: { minutes: 3, bonus: { hpRegen: 2 } },
  EdibleFood: { minutes: 4, bonus: { hpRegen: 2, mpRegen: 1 } },
  CookedFood: { minutes: 6, bonus: { hpRegen: 4 } },
  SpecialFood: { minutes: 8, bonus: { hpRegen: 3, mpRegen: 3 } },
  Drinks: { minutes: 5, bonus: { mpRegen: 2 } },
};

export function getSatietyInfo(category) {
  return SATIETY_BY_CATEGORY[category] ?? null;
}

// Come um alimento: a duração sempre SOMA ao tempo restante (comer 2 alimentos
// diferentes seguidos dá a duração dos dois somada). O BÔNUS só troca se a saciedade
// atual já tiver zerado — se você já está saciado, o bônus de quem comeu primeiro
// continua valendo, o novo alimento só estende o tempo.
export function eatFood(currentSatiety, category) {
  const info = getSatietyInfo(category);
  if (!info) return currentSatiety;

  const addedMs = info.minutes * 60000;
  const stillSated = (currentSatiety?.remainingMs ?? 0) > 0;

  return {
    remainingMs: (currentSatiety?.remainingMs ?? 0) + addedMs,
    bonus: stillSated ? currentSatiety.bonus : info.bonus,
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
