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

// Quests especiais (fora do padrão "mate X na zona Y"): marco de nível com recompensa
// que depende da vocação escolhida, e uma quest de abate de um monstro específico (não
// da zona toda). Item de recompensa nasce com raridade sorteada igual um drop de
// monstro (ver getItemDefinition em lootItems.js) — pros itens abaixo, a fonte real só
// documenta 1 variante de raridade pra Euler Pants/Mireling Legs/Plated Legs (não são
// itens "de drop comum" com progressão de qualidade), então o sorteio sempre cai em
// "common" pra esses 3; só o Wolf Helmet tem as 5 raridades reais pra sortear de fato.
export const SPECIAL_QUESTS = [
  {
    id: 'marco-nivel-35',
    label: 'Marco: Nível 35',
    description: 'Alcance o nível 35. A recompensa depende da sua vocação (Mage/Rogue/Knight).',
    kind: 'level',
    minLevel: 35,
    rewardItemByClass: { Mage: 'Euler Pants', Rogue: 'Mireling Legs', Knight: 'Plated Legs' },
    rewardGold: 0,
    rewardXp: 0,
  },
  {
    id: 'cacador-do-alpha-wolf',
    label: 'Caçador do Alpha Wolf',
    description: 'Derrote 300 Alpha Wolf (Toca do Alpha Wolf).',
    kind: 'monsterKills',
    monsterName: 'Alpha Wolf',
    requiredKills: 300,
    rewardItem: 'Wolf Helmet',
    rewardGold: 0,
    rewardXp: 0,
  },
];

export const SPECIAL_QUESTS_BY_ID = Object.fromEntries(SPECIAL_QUESTS.map((q) => [q.id, q]));

// Nome do item que essa quest especial vai dar — fixo (rewardItem) ou condicional à
// vocação do personagem (rewardItemByClass). Squire (sem vocação escolhida ainda) não
// tem entrada no mapa, então não tem recompensa até escolher Mage/Rogue/Knight.
export function specialQuestRewardItemName(character, quest) {
  return quest.rewardItem ?? quest.rewardItemByClass?.[character?.class] ?? null;
}

export function isSpecialQuestComplete(character, quest) {
  if (!specialQuestRewardItemName(character, quest)) return false;
  if (quest.kind === 'level') return (character.level ?? 0) >= quest.minLevel;
  if (quest.kind === 'monsterKills') {
    return (character.monsterKills?.[quest.monsterName] ?? 0) >= quest.requiredKills;
  }
  return false;
}
