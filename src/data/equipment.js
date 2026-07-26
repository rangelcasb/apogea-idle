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
