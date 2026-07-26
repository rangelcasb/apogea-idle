import { ZONES } from './zones.js';

// Quests geradas a partir das zonas reais: "mate X criaturas em {zona}". Não existem
// quests documentadas publicamente pro Apogea real com essa estrutura — é uma mecânica
// nossa pra dar objetivo ao grind. As recompensas são coerentes com a dificuldade real
// de cada zona (escalam com o xp/h e gold/h reais daquela zona) e com o tamanho da
// meta (mais mortes exigidas = recompensa proporcionalmente maior).
const TIERS = [
  { count: 10, mult: 1, label: 'Iniciante' },
  { count: 50, mult: 4.5, label: 'Experiente' },
  { count: 200, mult: 18, label: 'Veterano' },
];

export const QUESTS = ZONES.flatMap((zone) =>
  TIERS.map((tier) => ({
    id: `${zone.id}-kills-${tier.count}`,
    zoneId: zone.id,
    zoneName: zone.name,
    label: tier.label,
    requiredKills: tier.count,
    description: `Derrote ${tier.count} criaturas em ${zone.name}.`,
    rewardGold: Math.max(5, Math.round(zone.goldPerHour * 0.15 * tier.mult)),
    rewardXp: Math.max(10, Math.round(zone.xpPerHour * 0.15 * tier.mult)),
  })),
);

export const QUESTS_BY_ZONE = QUESTS.reduce((map, q) => {
  (map[q.zoneId] ??= []).push(q);
  return map;
}, {});

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function isQuestComplete(character, quest) {
  return (character.zoneKills?.[quest.zoneId] ?? 0) >= quest.requiredKills;
}

export function isQuestClaimed(character, quest) {
  return character.claimedQuests?.includes(quest.id) ?? false;
}
