// Magias reais do Apogea, extraídas de apogean.eu/lists/spells (chunk-RMFHGKOU.js).
// A fonte também documenta "might not be accurate", mas é a única fonte real que
// encontramos com fórmula, requisito de Magic/Ability, custo de mana e cooldown.
//
// Só entram como "castable" (usáveis pelo auto-cast) as magias com fórmula de dano ou
// cura clara, ou (caso de QuickAttack, `kind: 'buff'`) um efeito bem definido que dê
// pra aproximar sem precisar de um sistema de buff temporizado de verdade. Magias de
// utilidade puras sem efeito numérico aproximável (Dash, Haste, Taunt-sem-dano, Magic
// Wall, Mana Shield, Slow, etc.) continuam de fora.
//
// bookName é o sufixo usado nos itens "<Cor> Spellbook: <bookName>" em items.js.
//
// Cooldowns em branco na fonte (spells com fórmula de dano mas sem cooldown listado)
// recebem um valor padrão (DEFAULT_COOLDOWN_MS) — não é um número oficial do jogo,
// é só pra manter esses feitiços utilizáveis no auto-cast sem deixá-los infinitos.
export const DEFAULT_COOLDOWN_MS = 6000;
export const SPELL_SLOTS = 3;
// Limiar padrão de vida (%) em que uma magia de cura entra em ação no auto-cast, até
// o jogador configurar o dele na aba Magias — 80% evita gastar mana curando 5% de
// pouca coisa quando a vida já tá quase cheia.
export const DEFAULT_HEAL_THRESHOLD_PCT = 80;

// "type" é a escola da magia (Physical/Blade/Fire/Energy/Water/Earth/Holy/Light/Arrow/
// Death/Conjure/Heal/Defense), também extraída de apogean.eu/lists/spells — usado pelos
// talentos do ramo Cajado que dependem da ESCOLA da magia (ex: "Fire spells", "Water
// spells", "Elemental spell") e não só de causar dano.
// Evil Spellbook: ConjureDeath e DarkBind — a fonte real (apogean.eu) confirma que
// essas 2 magias existem e dão a descrição do efeito, mas o campo "formula" delas vem
// VAZIO (sem número documentado), diferente de todas as outras. Aproximamos com base
// no custo/cooldown relativo às magias vizinhas do mesmo livro (Vampiric Bite), igual
// fizemos com os talentos sem mecânica simulável — deixado claro que não é o valor
// oficial. VampiricBite também ganhou o lifesteal que a descrição real menciona
// ("leeching life") mas não documenta a porcentagem — 30% é estimativa nossa também.
export const SPELLS = [
  { id: 'Thrash', bookName: 'Thrash', book: 'Red Spellbook: Thrash', color: 'Red', type: 'Physical', magicReq: 0, abilityReq: 0, manaCost: 40, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 10, damagePct: 5 },
  { id: 'VampiricBite', bookName: 'VampiricBite', book: 'Evil Spellbook: VampiricBite', color: 'Evil', type: 'Death', magicReq: 0, abilityReq: 0, manaCost: 200, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 10, magicPct: 20, lifestealPercent: 30 },
  { id: 'ConjureDeath', bookName: 'ConjureDeath', book: 'Evil Spellbook: ConjureDeath', color: 'Evil', type: 'Death', magicReq: 5, abilityReq: 0, manaCost: 200, cooldownMs: 2000, hpCast: true, kind: 'damage', base: 5, magicPct: 8 },
  { id: 'DarkBind', bookName: 'DarkBind', book: 'Evil Spellbook: DarkBind', color: 'Evil', type: 'Death', magicReq: 15, abilityReq: 0, manaCost: 500, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 50, magicPct: 50 },
  { id: 'Berserk', bookName: 'Berserk', book: 'Red Spellbook: Berserk', color: 'Red', type: 'Blade', magicReq: 1, abilityReq: 20, manaCost: 35, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 15, damagePct: 35 },
  // Quick Attack é do tipo Time/Mystic (a PRIMEIRA magia castável dessa categoria nesse
  // jogo) — real: "Increases your Attackspeed by 6 for 4 seconds". Esse jogo não tem
  // buff temporizado de combate de verdade (o loop de ataque roda num timer recalculado
  // só quando o personagem muda), então vira `kind: 'buff'`, tratado à parte em
  // useGameState.js: aproximado como 1 golpe básico extra imediato no alvo focado (a
  // mesma ideia de "atacar mais rápido por um instante", sem precisar de um sistema de
  // buff temporizado só pra essa magia).
  { id: 'QuickAttack', bookName: 'QuickAttack', book: 'Red Spellbook: QuickAttack', color: 'Red', type: 'Time', magicReq: 6, abilityReq: 35, manaCost: 70, cooldownMs: 7000, hpCast: false, kind: 'buff' },
  { id: 'Taunt', bookName: 'Taunt', book: 'Green Spellbook: Taunt', color: 'Green', type: 'Conjure', magicReq: 1, abilityReq: 0, manaCost: 25, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: true, kind: 'damage', base: 10, damagePct: 5 },
  // Cura escala com Magic/Ability do personagem (1:1 e 0,5:1), não com % de vida
  // faltando — balanceamento nosso, a pedido do usuário (ver fórmula em useGameState.js).
  { id: 'Heal', bookName: 'Heal', book: 'Blue Spellbook: Heal', color: 'Blue', type: 'Heal', magicReq: 2, abilityReq: 0, manaCost: 25, cooldownMs: 1500, hpCast: false, kind: 'heal' },
  { id: 'ShieldBlock', bookName: 'ShieldBlock', book: 'Yellow Spellbook: ShieldBlock', color: 'Yellow', type: 'Defense', magicReq: 2, abilityReq: 10, manaCost: 30, cooldownMs: 5000, hpCast: false, kind: 'damage', base: 25, magicPct: 35 },
  { id: 'Charge', bookName: 'Charge', book: 'Red Spellbook: Charge', color: 'Red', type: 'Physical', magicReq: 3, abilityReq: 30, manaCost: 75, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 25, damagePct: 50 },
  { id: 'PreciseShot', bookName: 'PreciseShot', book: 'Red Spellbook: PreciseShot', color: 'Red', type: 'Arrow', magicReq: 5, abilityReq: 10, manaCost: 40, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 15, magicPct: 10, damagePct: 20 },
  { id: 'ConjureFire', bookName: 'ConjureFire', book: 'Red Spellbook: ConjureFire', color: 'Red', type: 'Fire', magicReq: 5, abilityReq: 0, manaCost: 35, cooldownMs: 2000, hpCast: false, kind: 'damage', base: 20, magicPct: 25 },
  { id: 'EnergyBolt', bookName: 'EnergyBolt', book: 'Red Spellbook: EnergyBolt', color: 'Red', type: 'Energy', magicReq: 7, abilityReq: 0, manaCost: 35, cooldownMs: 2000, hpCast: false, kind: 'damage', base: 25, magicPct: 20 },
  { id: 'Adjure', bookName: 'Adjure', book: 'Blue Spellbook: Adjure', color: 'Blue', type: 'Light', magicReq: 9, abilityReq: 0, manaCost: 100, cooldownMs: 10000, hpCast: false, kind: 'damage', base: 50, magicPct: 20 },
  { id: 'Holy', bookName: 'Holy', book: 'Yellow Spellbook: Holy', color: 'Yellow', type: 'Holy', magicReq: 10, abilityReq: 0, manaCost: 35, cooldownMs: 2500, hpCast: false, kind: 'damage', base: 25, magicPct: 25 },
  { id: 'LightMissile', bookName: 'LightMissile', book: 'Blue Spellbook: LightMissile', color: 'Blue', type: 'Heal', magicReq: 10, abilityReq: 0, manaCost: 30, cooldownMs: 5000, hpCast: false, kind: 'damage', base: 10, magicPct: 20 },
  { id: 'CryingArrow', bookName: 'CryingArrow', book: 'Red Spellbook: CryingArrow', color: 'Red', type: 'Arrow', magicReq: 10, abilityReq: 35, manaCost: 175, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 35, magicPct: 25, damagePct: 65 },
  { id: 'RockThrow', bookName: 'RockThrow', book: 'Red Spellbook: RockThrow', color: 'Red', type: 'Earth', magicReq: 15, abilityReq: 0, manaCost: 65, cooldownMs: 4600, hpCast: false, kind: 'damage', base: 25, magicPct: 35 },
  { id: 'WaterPillar', bookName: 'WaterPillar', book: 'Red Spellbook: WaterPillar', color: 'Red', type: 'Water', magicReq: 30, abilityReq: 0, manaCost: 95, cooldownMs: 15000, hpCast: false, kind: 'damage', base: 30, magicPct: 35 },
  { id: 'Fireball', bookName: 'Fireball', book: 'Red Spellbook: Fireball', color: 'Red', type: 'Fire', magicReq: 30, abilityReq: 0, manaCost: 125, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 35, magicPct: 50 },
  { id: 'EnergyHull', bookName: 'EnergyHull', book: 'Red Spellbook: EnergyHull', color: 'Red', type: 'Energy', magicReq: 25, abilityReq: 0, manaCost: 175, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 40, magicPct: 60 },
  { id: 'Lightning', bookName: 'Lightning', book: 'Red Spellbook: Lightning', color: 'Red', type: 'Energy', magicReq: 25, abilityReq: 0, manaCost: 75, cooldownMs: 7000, hpCast: false, kind: 'damage', base: 30, magicPct: 40 },
];

export const SPELLS_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

// "Elemental" pro talento Charge the Staff (ramo Cajado) = as 4 escolas clássicas de
// elemento; não é um campo que a fonte real expõe direto, é a definição usual do gênero.
export const ELEMENTAL_SPELL_TYPES = ['Fire', 'Energy', 'Water', 'Earth'];

// Dano/cura de uma magia com os stats finais do personagem e o dano médio de golpe
// (computeDamageRoll(stats).avg) — ambos calculados pelo caller.
export function computeSpellEffect(spell, stats, avgWeaponDamage) {
  if (spell.kind === 'heal') return 0;
  let value = spell.base ?? 0;
  if (spell.magicPct) value += stats.magic * (spell.magicPct / 100);
  if (spell.damagePct) value += avgWeaponDamage * (spell.damagePct / 100);
  return value;
}

export function canCastSpell(spell, stats) {
  return stats.magic >= spell.magicReq && stats.ability >= spell.abilityReq;
}
