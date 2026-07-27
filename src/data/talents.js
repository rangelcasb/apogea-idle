// Árvore de talentos REAL do Apogea (nomes, descrições, ramos, ligações de pré-requisito
// e número de ranks), extraída da calculadora da comunidade (paszqa.github.io/apogea-traits).
// Fonte também confirma: 1 ponto de talento a cada 2 níveis.
//
// IMPORTANTE: este jogo idle não simula o sistema de magias ativas do Apogea real (Fire,
// Energy, Heal, Blade, Arrow spells etc.). Pra talentos que dependem só disso (redução de
// cooldown de magia, escudo mágico, etc.) o efeito aqui é um bônus pequeno aproximado —
// NÃO é o efeito real. Mas pra talentos que dependem de ARMA/ARMADURA equipada (lifeleech
// de adaga, dano de espada, defesa de escudo...), implementamos a mecânica de verdade E o
// requisito de equipamento: o talento só faz efeito se você tiver o item certo equipado.

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

// Requisito de equipamento por ramo — checado nos slots "weapon"/"offhand" (armas) ou
// nos 4 slots de armadura (cabeça/peitoral/pernas/botas). "core" (raiz) não exige nada.
const BRANCH_REQUIREMENTS = {
  staff: { slots: ['weapon', 'offhand'], categories: ['staff'] },
  dagger: { slots: ['weapon', 'offhand'], categories: ['dagger'] },
  bow: { slots: ['weapon', 'offhand'], categories: ['bow'] },
  sword: { slots: ['weapon', 'offhand'], categories: ['sword', 'largesword'] },
  shield: { slots: ['offhand'], categories: ['shield', 'lightshield', 'heavyshield', 'largeshield'] },
  orb: { slots: ['offhand'], categories: ['orb'] },
  lightarmor: { slots: ['head', 'chest', 'legs', 'boots'], categoryPrefix: 'light' },
  heavyarmor: { slots: ['head', 'chest', 'legs', 'boots'], categoryPrefix: 'heavy' },
};

export function branchRequirementLabel(branch) {
  const req = BRANCH_REQUIREMENTS[branch];
  if (!req) return null;
  const where = req.slots.includes('offhand') && req.slots.includes('weapon')
    ? 'mão principal ou secundária'
    : req.slots.includes('offhand')
      ? 'mão secundária'
      : 'peça de armadura';
  const what = req.categoryPrefix ? `${req.categoryPrefix === 'light' ? 'leve' : 'pesada'}` : req.categories.join('/');
  return `Requer ${what} equipada na ${where}`;
}

// Checa se o personagem cumpre o requisito de equipamento do ramo do talento. Sem
// requisito (ramo "core") sempre passa.
export function meetsTalentRequirement(equipment, branch) {
  const req = BRANCH_REQUIREMENTS[branch];
  if (!req) return true;
  return req.slots.some((slot) => {
    const item = equipment?.[slot];
    if (!item?.category) return false;
    if (req.categories) return req.categories.includes(item.category);
    if (req.categoryPrefix) return item.category.startsWith(req.categoryPrefix);
    return false;
  });
}

function parseRankValue(str) {
  if (!str) return NaN;
  const n = parseFloat(String(str).replace('%', ''));
  return Number.isNaN(n) ? NaN : n;
}

// Mecânicas REAIS implementadas de verdade (não é o bônus genérico) — cada uma lê o
// valor do rank atual (não é linear por ponto, é o valor real daquele rank específico).
// Os demais talentos (a maioria, presos a magias que não existem aqui) caem no
// bônus genérico simplificado de sempre.
const MECHANICS = {
  10: 'lifesteal', // Stabbing Preference — Daggers provide Lifeleech
  56: 'lifesteal', // Pondering It — Orbs provide Spellvamp
  11: 'armorPen', // Thorough Puncture — ignore some of target's armor
  12: 'critChance', // Shearing Stroke — chance of dealing 1.5x damage
  47: 'damagePercent', // Blade Training — Swords have more Damage
  48: 'damagePercent', // Wrecking It — Gain extra Item Damage
  32: 'armorPercent', // Block Efficacy — Shields have more defense
  39: 'armorPercent', // Well Protected — Heavy Armor has more Armor
  16: 'attackSpeedFlat', // Bow Guidance — Bows have extra Attackspeed (ranks já são flat)
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

// Requisito extra REAL (fonte: código-fonte da calculadora paszqa.github.io/apogea-traits)
// dos talentos "finais" de cada ramo (sem rank, um ponto só): além do pai direto
// precisar estar no MÁXIMO, o nó-tronco do ramo (o que conecta direto na raiz) também
// precisa estar maximizado. Ex: pra pegar "Luck Foreseen" (13), Shearing Stroke (12,
// pai direto) precisa estar nos 3 pontos E Stabbing Preference (10, tronco do ramo
// adaga) precisa estar nos 5 pontos.
const EXTRA_REQUIREMENTS = {
  4: [[3, 3], [1, 5]],
  63: [[62, 3], [1, 5]],
  7: [[6, 3], [1, 5]],
  9: [[8, 3], [1, 5]],
  13: [[10, 5], [12, 3]],
  15: [[10, 5], [14, 3]],
  19: [[16, 5], [18, 3]],
  21: [[16, 5], [20, 3]],
  24: [[23, 3], [16, 5]],
  28: [[27, 3], [25, 5]],
  31: [[30, 3], [25, 5]],
  36: [[32, 5], [34, 3]],
  38: [[37, 3], [32, 5]],
  42: [[41, 3], [39, 5]],
  45: [[44, 3], [39, 5]],
  50: [[49, 3], [47, 5]],
  52: [[51, 3], [47, 5]],
  54: [[47, 5], [53, 3]],
  59: [[56, 5], [58, 3]],
  61: [[56, 5], [60, 3]],
};

export const TALENTS = RAW_TALENTS.map((t) => ({
  ...t,
  maxPoints: Math.max(1, t.ranks.length),
  mechanic: MECHANICS[t.id] ?? null,
  effect: t.parent === null ? null : guessEffect(t.description),
  requirementLabel: branchRequirementLabel(t.branch),
}));

export const TALENTS_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export function talentPointsForLevel(level) {
  return Math.floor(level / POINTS_PER_TALENT_LEVELS);
}

export function spentTalentPoints(talentPoints) {
  return Object.values(talentPoints ?? {}).reduce((sum, n) => sum + n, 0);
}

// Pré-requisito REAL (mesma lógica da calculadora oficial da comunidade):
// 1) O nível do filho nunca pode alcançar/ultrapassar o nível ATUAL do pai — dá pra
//    intercalar (pai+1, filho+1, pai+1, filho+1...), mas o filho nunca fica à frente.
//    Nós ligados direto na raiz (parent 0) não têm essa trava.
// 2) Talentos finais de cada ramo (ver EXTRA_REQUIREMENTS) também exigem o nó-tronco
//    do ramo maximizado, além do pai direto maximizado.
export function canInvestTalent(talentPoints, talentId) {
  const talent = TALENTS_BY_ID[talentId];
  if (!talent || talent.parent === null) return false;
  const current = talentPoints?.[talentId] ?? 0;
  if (current >= talent.maxPoints) return false;

  if (talent.parent !== 0) {
    const parentLevel = talentPoints?.[talent.parent] ?? 0;
    if (current >= parentLevel) return false;
  }

  const extra = EXTRA_REQUIREMENTS[talentId];
  if (extra) {
    for (const [reqId, reqLevel] of extra) {
      if ((talentPoints?.[reqId] ?? 0) < reqLevel) return false;
    }
  }

  return true;
}

// Agrega os efeitos de TODOS os talentos investidos E cujo requisito de equipamento
// esteja satisfeito AGORA (troca de arma liga/desliga o talento na hora). Mecânicas
// reais (lifesteal, armorPen, crit, %dano, %armadura) vão em campos próprios; o resto
// cai no bônus genérico simplificado de sempre.
export function computeTalentModifiers(talentPoints, equipment) {
  const mods = {
    statBonuses: {},
    lifestealPercent: 0,
    armorPenPercent: 0,
    critChance: 0,
    critMultiplier: 1.5,
    damagePercent: 0,
    armorPercent: 0,
  };

  for (const [idStr, points] of Object.entries(talentPoints ?? {})) {
    const talent = TALENTS_BY_ID[idStr];
    if (!talent || !points) continue;
    if (!meetsTalentRequirement(equipment, talent.branch)) continue;

    const rankValue = parseRankValue(talent.ranks[Math.min(points, talent.maxPoints) - 1]);

    switch (talent.mechanic) {
      case 'lifesteal':
        if (!Number.isNaN(rankValue)) mods.lifestealPercent += rankValue;
        break;
      case 'armorPen':
        if (!Number.isNaN(rankValue)) mods.armorPenPercent += rankValue;
        break;
      case 'critChance':
        if (!Number.isNaN(rankValue)) mods.critChance += rankValue / 100;
        break;
      case 'damagePercent':
        if (!Number.isNaN(rankValue)) mods.damagePercent += rankValue;
        break;
      case 'armorPercent':
        if (!Number.isNaN(rankValue)) mods.armorPercent += rankValue;
        break;
      case 'attackSpeedFlat':
        if (!Number.isNaN(rankValue)) mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + rankValue;
        break;
      default: {
        if (!talent.effect) break;
        const { stat, perRank } = talent.effect;
        mods.statBonuses[stat] = (mods.statBonuses[stat] ?? 0) + points * perRank;
      }
    }
  }

  return mods;
}

// Aplica os modificadores de talento (já filtrados por requisito de equipamento) sobre
// os stats. Lifesteal/armorPen/critChance/critMultiplier ficam anexados no objeto de
// stats pro combate usar; damagePercent/armorPercent multiplicam damage/armor.
export function applyTalentEffects(stats, character) {
  const mods = computeTalentModifiers(character?.talentPoints, character?.equipment);
  const next = { ...stats };

  for (const [key, val] of Object.entries(mods.statBonuses)) {
    next[key] = Math.round(((next[key] ?? 0) + val) * 100) / 100;
  }
  if (mods.damagePercent) next.damage = Math.round(next.damage * (1 + mods.damagePercent / 100) * 100) / 100;
  if (mods.armorPercent) next.armor = Math.round(next.armor * (1 + mods.armorPercent / 100) * 100) / 100;

  next.lifestealPercent = mods.lifestealPercent;
  next.armorPenPercent = mods.armorPenPercent;
  next.critChance = mods.critChance;
  next.critMultiplier = mods.critMultiplier;
  return next;
}
