export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  MATERIAL: 'material',
};

// 10 slots de equipamento reais, exatamente como na tela "EQUIPAMENTO — MÃOS: 10/10"
// que o usuário enviou (Arma, Mão Secundária, Cabeça, Peitoral, Pernas, Botas, Munição,
// Pescoço, Anel, Mochila). Luvas ("Gloves") são reais mas ocupam o slot "weapon" no
// jogo original (tipo "hand" nos dados), então entram como arma alternativa aqui.
export const EQUIP_SLOTS = {
  weapon: 'Arma',
  offhand: 'Mão Secundária',
  head: 'Cabeça',
  chest: 'Peitoral',
  legs: 'Pernas',
  boots: 'Botas',
  ammo: 'Munição',
  neck: 'Pescoço',
  ring: 'Anel',
  backpack: 'Mochila',
};

// Tamanho máximo combinado (arma + mão secundária) — real, é o "MÃOS: X/10" da tela.
export const HAND_CAPACITY = 10;

// Ordem crescente de raridade de instância — usada pra comparar "pelo menos X"
// (ex: blacklist condicional "só pegar Torch a partir de épico").
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export function rarityAtLeast(rarity, minRarity) {
  if (!minRarity) return true;
  const idx = RARITY_ORDER.indexOf(rarity);
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  if (idx === -1 || minIdx === -1) return true;
  return idx >= minIdx;
}

// Cores por raridade de instância (common/uncommon/rare/epic/legendary), pra UI.
export const RARITY_LABELS = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};
export const RARITY_COLORS = {
  common: 'text-neutral-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-gold',
};

// Nomes em português pra cada chave de stat que um item pode dar — usado em toda
// tela que mostra item.stats (Mochila, Personagem, Mercador), pra não exibir chaves
// em inglês cru como "attackSpeed".
export const STAT_LABELS = {
  damage: 'Dano',
  armor: 'Armadura',
  defense: 'Defesa',
  health: 'Vida',
  mana: 'Mana',
  ability: 'Ability',
  magic: 'Magic',
  attackSpeed: 'Vel. Ataque',
  capacity: 'Capacidade',
  hpRegen: 'HP Regen',
  mpRegen: 'MP Regen',
};

// Formata o objeto de stats de um item em texto legível: "Dano +5 · Vel. Ataque +0.09".
export function formatItemStats(stats) {
  if (!stats) return null;
  return Object.entries(stats)
    .map(([key, value]) => {
      const label = STAT_LABELS[key] ?? key;
      const rounded = Math.round(value * 100) / 100;
      return `${label} ${rounded > 0 ? '+' : ''}${rounded}`;
    })
    .join(' · ');
}
