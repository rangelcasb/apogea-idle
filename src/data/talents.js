// Árvore de talentos REAL do Apogea (nomes, descrições, ramos, ligações de pré-requisito
// e número de ranks), extraída da calculadora da comunidade (paszqa.github.io/apogea-traits).
// Fonte também confirma: 1 ponto de talento a cada 2 níveis.
//
// IMPORTANTE: este jogo idle não simula o sistema de magias ativas do Apogea real (Fire,
// Energy, Heal, Blade, Arrow spells etc.), que é do que a maioria desses talentos depende.
// Por isso, cada talento aqui tem um EFEITO SIMPLIFICADO nosso (um bônus pequeno num stat
// existente, escolhido por palavra-chave da descrição real) só pra ele fazer algo no jogo —
// isso NÃO é o efeito real do talento, é uma aproximação para essa versão simplificada.

export const POINTS_PER_TALENT_LEVELS = 2; // 1 ponto a cada 2 níveis

export const TALENT_BRANCHES = {
  core: 'Raiz',
  staff: 'Cajado',
  dagger: 'Adaga',
  bow: 'Arco',
  lightarmor: 'Armadura Leve',
  shield: 'Escudo',
  heavyarmor: 'Armadura Pesada',
  sword: 'Espada',
  orb: 'Orbe',
};

function guessEffect(description) {
  const d = description.toLowerCase();
  if (d.includes('attackspeed')) return { stat: 'attackSpeed', perRank: 0.02 };
  if (d.includes('damage')) return { stat: 'damage', perRank: 1 };
  if (d.includes('armor') || d.includes('defense')) return { stat: 'armor', perRank: 1 };
  if (d.includes('health')) return { stat: 'health', perRank: 3 };
  if (d.includes('mana')) return { stat: 'mana', perRank: 3 };
  if (d.includes('magic')) return { stat: 'magic', perRank: 1 };
  return { stat: 'ability', perRank: 1 };
}

const RAW_TALENTS = [
  { id: 0, name: 'Start Here', parent: null, branch: 'core', description: 'Level 1 starting point.', ranks: [] },

  { id: 1, name: 'Staff Mastery', parent: 0, branch: 'staff', description: 'Staves have a chance of shooting without a cost', ranks: ['5%', '10%', '20%', '35%', '75%'] },
  { id: 2, name: 'Charge the Staff', parent: 1, branch: 'staff', description: "Casting an energy Fire spell using a staff will make your next attack deal damage", ranks: ['ML/5', 'ML/4', 'ML/2'] },
  { id: 3, name: 'Frantic Conjury', parent: 2, branch: 'staff', description: "Casting a Fire spell has a chance your next attack will cast Conjure Fire on target's location", ranks: ['20%', '30%', '50%'] },
  { id: 4, name: 'Warlock', parent: 3, branch: 'staff', description: 'While holding a staff, gain 1 extra Area of Effect for Energy and Fire spells', ranks: [] },
  { id: 5, name: 'Magic Touch', parent: 1, branch: 'staff', description: 'Heal spells are stronger by:', ranks: ['10%', '15%', '25%'] },
  { id: 6, name: 'Healing Stick', parent: 5, branch: 'staff', description: 'While holding a staff, reduces the cooldown of Heal and Holy spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 7, name: "Child's Channel", parent: 6, branch: 'staff', description: 'Healing others also heals you by 50% and Heal and Light spells are 50% cheaper', ranks: [] },
  { id: 8, name: "Apogea's Ardor", parent: 5, branch: 'staff', description: 'Reduces the cooldown of Earth and Water spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 9, name: "Gallop's Fall", parent: 8, branch: 'staff', description: 'While holding a staff, gain 1 extra area of effect for Water and Holy spells', ranks: [] },
  { id: 62, name: 'Electric Nature', parent: 2, branch: 'staff', description: 'Reduces the cooldown of Energy spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 63, name: 'Steering Insight', parent: 62, branch: 'staff', description: 'Energy and Arrow projectile spells bounce when colliding with enemies and explode on death', ranks: [] },

  { id: 10, name: 'Stabbing Preference', parent: 0, branch: 'dagger', description: 'Daggers provide Lifeleech', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 11, name: 'Thorough Puncture', parent: 10, branch: 'dagger', description: "Physical attacks ignore some of the target's armor", ranks: ['8%', '13%', '20%'] },
  { id: 12, name: 'Shearing Stroke', parent: 11, branch: 'dagger', description: 'Attacks have a chance of dealing 1.5x damage', ranks: ['10%', '14%', '20%'] },
  { id: 13, name: 'Luck Foreseen', parent: 12, branch: 'dagger', description: 'Converts 7 Ability into 1% chance of attacking twice', ranks: [] },
  { id: 14, name: 'Gaff Hack', parent: 11, branch: 'dagger', description: 'Casting a Mystic or Time spell has a chance of boosting your Attackspeed by 10 for 4s', ranks: ['20%', '30%', '50%'] },
  { id: 15, name: 'Double Danger', parent: 14, branch: 'dagger', description: 'Using two daggers double your Item Damage', ranks: [] },

  { id: 16, name: 'Bow Guidance', parent: 0, branch: 'bow', description: 'Bows have extra Attackspeed', ranks: ['1', '2', '3', '4', '6'] },
  { id: 17, name: 'Good Technique', parent: 16, branch: 'bow', description: 'Gain extra Range', ranks: ['1', '2', '4'] },
  { id: 18, name: 'Artisanal Arsenal', parent: 17, branch: 'bow', description: 'Non-magic arrows deal extra Damage and break less often', ranks: ['1', '2', '4'] },
  { id: 19, name: 'Explosive Ammo', parent: 18, branch: 'bow', description: 'Arrows have a 25% chance of exploding dealing area damage that briefly slows', ranks: [] },
  { id: 20, name: 'Shineshooter', parent: 17, branch: 'bow', description: 'Reduces the cooldown of Light and Arrow of spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 21, name: 'Bullseye', parent: 20, branch: 'bow', description: 'Increases the Damage of Arrow and Blade spells against enemies you have currently targeted', ranks: [] },
  { id: 22, name: 'True Grip', parent: 16, branch: 'bow', description: 'While wearing Gloves attacking regenerates Mana', ranks: ['1', '2', '5'] },
  { id: 23, name: 'Elvish Practice', parent: 22, branch: 'bow', description: 'Reduces the cooldown of Time and Mystic spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 24, name: 'Arcane Trickster', parent: 23, branch: 'bow', description: 'While using Gloves, casting Time or Mystic spells has a 50% chance of blocking all physical damage for 3 seconds', ranks: [] },

  { id: 25, name: 'Cozy and Useful', parent: 0, branch: 'lightarmor', description: 'Light Armor is lighter', ranks: ['1%', '5%', '10%', '17%', '25%'] },
  { id: 26, name: 'Breeze in Your Hair', parent: 25, branch: 'lightarmor', description: 'Not wearing a helmet gives you Movespeed', ranks: ['1', '2', '3'] },
  { id: 27, name: 'Lightfoot', parent: 26, branch: 'lightarmor', description: 'If all your equipment weighs less than 150oz, gain Movespeed', ranks: ['1', '2', '3'] },
  { id: 28, name: 'Battle Boots', parent: 27, branch: 'lightarmor', description: 'Converts all extra Movespeed into 2 Damage', ranks: [] },
  { id: 29, name: 'Dressing Wizardly', parent: 25, branch: 'lightarmor', description: 'Armor gives you Mana for each oz under X oz, capped at 20 Mana', ranks: ['25oz', '33oz', '45oz'] },
  { id: 30, name: 'Powerful Space', parent: 29, branch: 'lightarmor', description: 'Gain 5% Magic for each X Free Capacity you have, capping at 20%', ranks: ['50', '35', '15'] },
  { id: 31, name: 'Clothes of the Damned', parent: 30, branch: 'lightarmor', description: 'Removes negative effects from light armor and gain 5% Magic for each equipped light armor', ranks: [] },

  { id: 32, name: 'Block Efficacy', parent: 0, branch: 'shield', description: 'Shields have more defense', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 33, name: 'Bread and Butter', parent: 32, branch: 'shield', description: 'Using a sword and shield gives you extra damage', ranks: ['2', '4', '8'] },
  { id: 34, name: 'Deflect', parent: 33, branch: 'shield', description: 'Blocking with a magic shield reflects damage taken', ranks: ['50%', '70%', '100%'] },
  { id: 35, name: 'Darkness Embrace', parent: 31, branch: 'shield', description: 'Death spells are 10 times cheaper. Heal and Light spells are 10 times more expensive', ranks: [] },
  { id: 36, name: 'Bulwark Leap', parent: 34, branch: 'shield', description: 'While holding a shield, casting a Time spell will double your magic shield, capping at 200', ranks: [] },
  { id: 37, name: 'Shieldslam', parent: 33, branch: 'shield', description: 'Blocking an attack has a chance of staggering the attacker', ranks: ['7%', '10%', '15%'] },
  { id: 38, name: 'Hex Parry', parent: 37, branch: 'shield', description: 'Successfully blocking an attack will empower your next Arrow or Blade spell', ranks: [] },

  { id: 39, name: 'Well Protected', parent: 0, branch: 'heavyarmor', description: 'Heavy Armor has more Armor', ranks: ['1%', '5%', '10%', '17%', '25%'] },
  { id: 40, name: 'Bulking Up', parent: 39, branch: 'heavyarmor', description: 'Gain Health for each equipped heavy armor', ranks: ['5', '10', '25'] },
  { id: 41, name: 'Heavy Metal', parent: 40, branch: 'heavyarmor', description: 'If all your equipment weighs more than 150oz, gain Armor', ranks: ['5%', '10%', '20%'] },
  { id: 42, name: 'Carry Your Might', parent: 41, branch: 'heavyarmor', description: 'Each 75 max capacity gives you 1 extra Armor and 10 Health, capping at 15 Armor and 150 Health', ranks: [] },
  { id: 43, name: 'Royal Banner', parent: 39, branch: 'heavyarmor', description: 'Reduces the cooldown of Time and Heal spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 44, name: 'Magic Steel', parent: 43, branch: 'heavyarmor', description: 'Casting a Time or Heal spell will give you a shield equal to a percentage of your total armor:', ranks: ['75%', '100%', '150%'] },
  { id: 45, name: 'Blessed Plate', parent: 44, branch: 'heavyarmor', description: 'Removes negative stats from heavy armor and gain 15 Mana for each equipped heavy armor', ranks: [] },
  { id: 46, name: 'Endowed in Steel', parent: 45, branch: 'heavyarmor', description: 'Attacking using both your hands gives you multiple stat boosts', ranks: [] },

  { id: 47, name: 'Blade Training', parent: 0, branch: 'sword', description: 'Swords have more Damage', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 48, name: 'Wrecking It', parent: 47, branch: 'sword', description: 'Gain extra Item Damage', ranks: ['3%', '6%', '10%'] },
  { id: 49, name: 'No Defense Needed', parent: 48, branch: 'sword', description: 'Damage to swords of size 7 or bigger', ranks: ['3%', '6%', '10%'] },
  { id: 50, name: 'Magic Blade', parent: 49, branch: 'sword', description: 'Removes negative effects from size 7 or bigger swords and gain 10% Manaleech', ranks: [] },
  { id: 51, name: 'Hand Finesse', parent: 48, branch: 'sword', description: 'Gain 1 Attackspeed for each X Ability you have capping at 5', ranks: ['15', '13', '10'] },
  { id: 52, name: 'Blade Prowess', parent: 51, branch: 'sword', description: 'While holding one sword of size 6 and no shield, reduces the cooldown of Blade spells by 50%', ranks: [] },
  { id: 53, name: 'Dual-Wielding', parent: 48, branch: 'sword', description: 'Size 6 swords have an equipsize of 5, but deal reduced Damage by:', ranks: ['40%', '36%', '30%'] },
  { id: 54, name: 'To Be Ninja', parent: 53, branch: 'sword', description: 'Converts all extra Ability into Attackspeed', ranks: [] },
  { id: 55, name: 'Fancing Classes', parent: 47, branch: 'sword', description: 'Blade spells are stronger by:', ranks: ['5%', '9%', '15%'] },

  { id: 56, name: 'Pondering It', parent: 0, branch: 'orb', description: 'Orbs provide Spellvamp', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 57, name: 'Unnatural Flow', parent: 56, branch: 'orb', description: 'Your attacks will deal extra magic damage', ranks: ['4', '7', '12'] },
  { id: 58, name: 'Flaming Sword', parent: 57, branch: 'orb', description: 'Casting a Fire or Blade spell will make your next attack deal extra magic damage', ranks: ['4', '8', '15'] },
  { id: 59, name: 'Conflagrated Mind', parent: 58, branch: 'orb', description: 'While holding an orb, reduces the cooldown of Fire spells by 35%', ranks: [] },
  { id: 60, name: 'Diamond Skin', parent: 57, branch: 'orb', description: 'Casting an Energy or Arrow spell will give you shield, stacking 3 times', ranks: ['20', '35', '50'] },
  { id: 61, name: 'Unstable Aegis', parent: 60, branch: 'orb', description: 'Taking shield damage will cast Unstable Berserk around yourself', ranks: [] },
];

export const TALENTS = RAW_TALENTS.map((t) => ({
  ...t,
  maxPoints: Math.max(1, t.ranks.length),
  effect: t.parent === null ? null : guessEffect(t.description),
}));

export const TALENTS_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export function talentPointsForLevel(level) {
  return Math.floor(level / POINTS_PER_TALENT_LEVELS);
}

export function spentTalentPoints(talentPoints) {
  return Object.values(talentPoints ?? {}).reduce((sum, n) => sum + n, 0);
}

// Pré-requisito simplificado: precisa ter pelo menos 1 ponto no talento-pai (a raiz,
// id 0, está sempre "ativa"). O jogo real exige ranks específicos do pai em alguns
// casos — simplificamos para "ao menos 1 ponto".
export function canInvestTalent(talentPoints, talentId) {
  const talent = TALENTS_BY_ID[talentId];
  if (!talent || talent.parent === null) return false;
  const current = talentPoints?.[talentId] ?? 0;
  if (current >= talent.maxPoints) return false;
  if (talent.parent === 0) return true;
  return (talentPoints?.[talent.parent] ?? 0) > 0;
}

// Aplica o efeito simplificado de cada talento investido sobre os stats já calculados.
export function applyTalentEffects(stats, talentPoints) {
  const next = { ...stats };
  for (const [idStr, points] of Object.entries(talentPoints ?? {})) {
    const talent = TALENTS_BY_ID[idStr];
    if (!talent?.effect || !points) continue;
    const { stat, perRank } = talent.effect;
    next[stat] = Math.round(((next[stat] ?? 0) + points * perRank) * 100) / 100;
  }
  return next;
}
