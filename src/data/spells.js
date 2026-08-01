// Magias reais do Apogea, extraídas de apogean.eu/lists/spells (chunk-RMFHGKOU.js).
// A fonte também documenta "might not be accurate", mas é a única fonte real que
// encontramos com fórmula, requisito de Magic/Ability, custo de mana e cooldown.
//
// Só entram como "castable" (usáveis pelo auto-cast) as magias com fórmula de dano ou
// cura clara. Magias de utilidade puras (Dash, Haste, Taunt-sem-dano, Magic Wall, Mana
// Shield, Slow, buffs de Attack Speed, etc.) não têm um efeito numérico que dê pra
// simular direito num jogo idle sem posicionamento/tempo real — ficam de fora da v1.
//
// bookName é o sufixo usado nos itens "<Cor> Spellbook: <bookName>" em items.js.
//
// Cooldowns em branco na fonte (spells com fórmula de dano mas sem cooldown listado)
// recebem um valor padrão (DEFAULT_COOLDOWN_MS) — não é um número oficial do jogo,
// é só pra manter esses feitiços utilizáveis no auto-cast sem deixá-los infinitos.
export const DEFAULT_COOLDOWN_MS = 6000;
export const SPELL_SLOTS = 3;

export const SPELLS = [
  { id: 'Thrash', bookName: 'Thrash', book: 'Red Spellbook: Thrash', color: 'Red', magicReq: 0, abilityReq: 0, manaCost: 40, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 10, damagePct: 5 },
  { id: 'VampiricBite', bookName: 'VampiricBite', book: 'Evil Spellbook: VampiricBite', color: 'Evil', magicReq: 0, abilityReq: 0, manaCost: 200, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 10, magicPct: 20 },
  { id: 'Berserk', bookName: 'Berserk', book: 'Red Spellbook: Berserk', color: 'Red', magicReq: 1, abilityReq: 20, manaCost: 35, cooldownMs: 7000, hpCast: true, kind: 'damage', base: 15, damagePct: 35 },
  { id: 'Taunt', bookName: 'Taunt', book: 'Green Spellbook: Taunt', color: 'Green', magicReq: 1, abilityReq: 0, manaCost: 25, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: true, kind: 'damage', base: 10, damagePct: 5 },
  { id: 'Heal', bookName: 'Heal', book: 'Blue Spellbook: Heal', color: 'Blue', magicReq: 2, abilityReq: 0, manaCost: 25, cooldownMs: 1500, hpCast: false, kind: 'heal', missingHealthPct: 5 },
  { id: 'ShieldBlock', bookName: 'ShieldBlock', book: 'Yellow Spellbook: ShieldBlock', color: 'Yellow', magicReq: 2, abilityReq: 10, manaCost: 30, cooldownMs: 5000, hpCast: false, kind: 'damage', base: 25, magicPct: 35 },
  { id: 'Charge', bookName: 'Charge', book: 'Red Spellbook: Charge', color: 'Red', magicReq: 3, abilityReq: 30, manaCost: 75, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 25, damagePct: 50 },
  { id: 'PreciseShot', bookName: 'PreciseShot', book: 'Red Spellbook: PreciseShot', color: 'Red', magicReq: 5, abilityReq: 10, manaCost: 40, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 15, magicPct: 10, damagePct: 20 },
  { id: 'ConjureFire', bookName: 'ConjureFire', book: 'Red Spellbook: ConjureFire', color: 'Red', magicReq: 5, abilityReq: 0, manaCost: 35, cooldownMs: 2000, hpCast: false, kind: 'damage', base: 20, magicPct: 25 },
  { id: 'EnergyBolt', bookName: 'EnergyBolt', book: 'Red Spellbook: EnergyBolt', color: 'Red', magicReq: 7, abilityReq: 0, manaCost: 35, cooldownMs: 2000, hpCast: false, kind: 'damage', base: 25, magicPct: 20 },
  { id: 'Adjure', bookName: 'Adjure', book: 'Blue Spellbook: Adjure', color: 'Blue', magicReq: 9, abilityReq: 0, manaCost: 100, cooldownMs: 10000, hpCast: false, kind: 'damage', base: 50, magicPct: 20 },
  { id: 'Holy', bookName: 'Holy', book: 'Yellow Spellbook: Holy', color: 'Yellow', magicReq: 10, abilityReq: 0, manaCost: 35, cooldownMs: 2500, hpCast: false, kind: 'damage', base: 25, magicPct: 25 },
  { id: 'LightMissile', bookName: 'LightMissile', book: 'Blue Spellbook: LightMissile', color: 'Blue', magicReq: 10, abilityReq: 0, manaCost: 30, cooldownMs: 5000, hpCast: false, kind: 'damage', base: 10, magicPct: 20 },
  { id: 'CryingArrow', bookName: 'CryingArrow', book: 'Red Spellbook: CryingArrow', color: 'Red', magicReq: 10, abilityReq: 35, manaCost: 175, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 35, magicPct: 25, damagePct: 65 },
  { id: 'RockThrow', bookName: 'RockThrow', book: 'Red Spellbook: RockThrow', color: 'Red', magicReq: 15, abilityReq: 0, manaCost: 65, cooldownMs: 4600, hpCast: false, kind: 'damage', base: 25, magicPct: 35 },
  { id: 'WaterPillar', bookName: 'WaterPillar', book: 'Red Spellbook: WaterPillar', color: 'Red', magicReq: 30, abilityReq: 0, manaCost: 95, cooldownMs: 15000, hpCast: false, kind: 'damage', base: 30, magicPct: 35 },
  { id: 'Fireball', bookName: 'Fireball', book: 'Red Spellbook: Fireball', color: 'Red', magicReq: 30, abilityReq: 0, manaCost: 125, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 35, magicPct: 50 },
  { id: 'EnergyHull', bookName: 'EnergyHull', book: 'Red Spellbook: EnergyHull', color: 'Red', magicReq: 25, abilityReq: 0, manaCost: 175, cooldownMs: DEFAULT_COOLDOWN_MS, hpCast: false, kind: 'damage', base: 40, magicPct: 60 },
  { id: 'Lightning', bookName: 'Lightning', book: 'Red Spellbook: Lightning', color: 'Red', magicReq: 25, abilityReq: 0, manaCost: 75, cooldownMs: 7000, hpCast: false, kind: 'damage', base: 30, magicPct: 40 },
];

export const SPELLS_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

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
