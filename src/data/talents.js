// Árvore de talentos REAL do Apogea. Reconstruída a partir do mapa oficial da wiki
// (apogea.fandom.com/wiki/Map:Trait_Tree, imagem "Trait_tree.png" datada de 13/06/2025),
// que substitui a fonte anterior (calculadora da comunidade paszqa.github.io/apogea-traits,
// mais antiga e sem os ramos Luva/Arma Grande que o jogo adicionou depois).
//
// LIMITAÇÃO HONESTA: a imagem da wiki mostra só o valor FINAL de cada talento (não a
// lista completa de ranks intermediários como a fonte antiga tinha). Onde o talento já
// existia antes com ranks confirmados (ou é claramente o mesmo nó, só reposicionado),
// mantive/reaproveitei a curva de crescimento real antiga. Pra talentos novos com valor
// único mostrado e que têm um talento "filho" (ou seja, claramente não são um nó final
// de 1 ponto só), projetei uma curva de 3 ranks usando a MÉDIA da forma de crescimento
// dos talentos de 3 ranks já confirmados da árvore antiga (primeiro rank ≈ 40% do
// valor final, segundo ≈ 65%, terceiro = 100% — média de curvas como Thorough Puncture
// 8/13/20 e Shearing Stroke 10/14/20). Pra talentos-folha (sem filho, sempre foram de
// 1 ponto só na fonte antiga) e pra valores pequenos demais pra uma curva fazer sentido,
// mantive rank único com o valor exato mostrado. Vale conferir no jogo.
//
// IMPORTANTE: este jogo idle não simula o sistema de magias ativas do Apogea real (Fire,
// Energy, Heal, Blade, Arrow spells etc.), nem "True Damage" (dano que ignora armadura
// por completo) ou Movespeed. Pra talentos que dependem só disso, o efeito aqui é um
// bônus pequeno aproximado — NÃO é o efeito real. Mas pra talentos que dependem de
// ARMA/ARMADURA equipada (lifeleech de adaga, dano de espada/arma grande, defesa de
// escudo...), implementamos a mecânica de verdade E o requisito de equipamento: o
// talento só faz efeito se você tiver o item certo equipado.

export const POINTS_PER_TALENT_LEVELS = 2; // 1 ponto a cada 2 níveis

export const TALENT_BRANCHES = {
  core: 'Raiz',
  staff: 'Cajado',
  dagger: 'Adaga',
  bow: 'Arco',
  glove: 'Luva',
  lightarmor: 'Armadura Leve',
  shield: 'Escudo',
  heavyarmor: 'Armadura Pesada',
  sword: 'Espada',
  largeweapon: 'Arma Grande',
  orb: 'Orbe',
};

// Requisito de equipamento por ramo — checado nos slots "weapon"/"offhand" (armas) ou
// nos 4 slots de armadura (cabeça/peitoral/pernas/botas). "core" (raiz) não exige nada.
// "sword" e "largeweapon" viraram ramos SEPARADOS nessa atualização (antes "sword"
// cobria as duas categorias juntas).
const BRANCH_REQUIREMENTS = {
  staff: { slots: ['weapon', 'offhand'], categories: ['staff'] },
  dagger: { slots: ['weapon', 'offhand'], categories: ['dagger'] },
  bow: { slots: ['weapon', 'offhand'], categories: ['bow'] },
  glove: { slots: ['weapon', 'offhand'], categories: ['gloves'] },
  sword: { slots: ['weapon', 'offhand'], categories: ['sword'] },
  largeweapon: { slots: ['weapon', 'offhand'], categories: ['largesword'] },
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
// Os demais talentos (a maioria, presos a magias/efeitos que não existem aqui) caem no
// bônus genérico simplificado de sempre.
const MECHANICS = {
  10: 'lifesteal', // Stabbing Preference — Daggers provide Lifeleech
  56: 'lifesteal', // Pondering It — Orbs provide Spellvamp
  11: 'armorPen', // Thorough Puncture — ignore some of target's armor
  12: 'critChance', // Shearing Stroke — chance of dealing 1.5x damage
  47: 'damagePercent', // Blade Training — Swords have more Damage
  80: 'damagePercent', // Going Big — Large Weapons have more Damage
  32: 'armorPercent', // Block Efficacy — Shields have more Defense
  16: 'attackSpeedFlat', // Bow Guidance — Bows have extra Attackspeed (ranks já são flat)
  67: 'trueDamageChance', // Jagged Rhythm — dagger, 50% chance of extra (Ability/4) True Damage
  68: 'doubleAttack', // Luck Foreseen II — Ability/6 = % chance of attacking twice
  69: 'trueDamageDouble', // Dark Blade — doubles True Damage dealt, but you take that too

  // Ramo Cajado — agora que o jogo tem magias de verdade (aba Magias, cooldown real),
  // dá pra implementar essas mecânicas de verdade em vez do bônus genérico de Ability.
  1: 'staffFreeCast', // Staff Mastery — chance do ATAQUE BÁSICO com cajado não gastar mana
  2: 'staffCharge', // Charge the Staff — magia Elemental carrega o próximo golpe com dano verdadeiro extra
  3: 'franticConjury', // Frantic Conjury — magia de Fogo tem chance de conjurar Conjure Fire de graça no próximo golpe
  62: 'spellCooldownReduction', // Electric Nature — reduz cooldown de TODAS as magias
  64: 'fireCooldownReduction', // Conflagrated Mind — reduz cooldown de magias de Fogo (25%, sem área de efeito nesse jogo)
  65: 'holyCooldownReduction', // Sacred Stick — reduz cooldown de magias Holy (25%, sem área de efeito nesse jogo)
  66: 'waterCooldownReduction', // Gallop's Fall — reduz cooldown de magias de Água (35%)
  4: 'elementalAoeBonus', // Warlock — sem sistema de área de efeito (1 monstro por vez), aproximado como +dano em Energia/Fogo
  63: 'projectileBounceBonus', // Steering Insight — sem sistema de ricochete, aproximado como +dano em Energia/Arco
};

// Valores fixos dos talentos de 1 ponto só do ramo Cajado que dependem de cooldown ou
// bônus aproximado — não escalam por rank (a fonte real não documenta um valor
// diferente, é a % citada na própria descrição do talento).
const FIRE_CD_REDUCTION_PCT = 25;
const HOLY_CD_REDUCTION_PCT = 25;
const WATER_CD_REDUCTION_PCT = 35;
// Warlock e Steering Insight prometem "área de efeito extra" / "ricochete e explosão"
// — esse jogo só tem 1 monstro por combate, então não existe como simular isso de
// verdade. Aproximei como um bônus fixo de dano nas escolas de magia certas, deixando
// claro que NÃO é a mecânica real (não tem multi-alvo aqui).
const WARLOCK_DAMAGE_BONUS_PCT = 15;
const STEERING_INSIGHT_DAMAGE_BONUS_PCT = 20;

// "ML/5", "ML/4", "ML/2" (Charge the Staff) — ML = Magic Level, ou seja, o divisor que
// aplica sobre o stat Magic final pra achar o dano verdadeiro extra daquele rank.
function parseMagicDivisor(str) {
  const m = /ML\/(\d+(?:\.\d+)?)/.exec(str || '');
  return m ? parseFloat(m[1]) : NaN;
}

// Valores fixos das 3 mecânicas de dano-verdadeiro/ataque-duplo da adaga (não escalam
// por rank — são talentos de 1 ponto só, o valor real vem direto da descrição).
const TRUE_DAMAGE_CHANCE = 0.5; // Jagged Rhythm: 50% de chance por golpe
const TRUE_DAMAGE_ABILITY_DIVISOR = 4; // Jagged Rhythm: dano extra = Ability / 4
const DOUBLE_ATTACK_ABILITY_DIVISOR = 6; // Luck Foreseen II: 6 Ability = 1% de chance

function guessEffect(description) {
  const d = description.toLowerCase();
  if (d.includes('attackspeed')) return { stat: 'attackSpeed', perRank: 0.02 };
  if (d.includes('damage')) return { stat: 'damage', perRank: 1 };
  if (d.includes('armor') || d.includes('defense')) return { stat: 'armor', perRank: 1 };
  if (d.includes('health')) return { stat: 'health', perRank: 3 };
  if (d.includes('mana')) return { stat: 'mana', perRank: 3 };
  if (d.includes('magic')) return { stat: 'magic', perRank: 1 };
  if (d.includes('ability')) return { stat: 'ability', perRank: 1 };
  return { stat: 'ability', perRank: 1 };
}

const RAW_TALENTS = [
  { id: 0, name: 'Start Here', parent: null, branch: 'core', description: 'Level 1 starting point.', ranks: [] },

  // ── Cajado ────────────────────────────────────────────────────────────────
  { id: 1, name: 'Staff Mastery', parent: 0, branch: 'staff', description: 'Staves have a chance of shooting without a cost', ranks: ['6%', '12%', '24%', '42%', '90%'] },
  { id: 2, name: 'Charge the Staff', parent: 1, branch: 'staff', description: 'Casting an Elemental spell using a staff will make your next attack deal extra True Damage', ranks: ['ML/5', 'ML/4', 'ML/2'] },
  { id: 3, name: 'Frantic Conjury', parent: 2, branch: 'staff', description: "Casting a Fire spell has a chance your next attack will cast Conjure Fire on target's location", ranks: ['20%', '30%', '50%'] },
  { id: 4, name: 'Warlock', parent: 3, branch: 'staff', description: 'While holding a staff, gain 1 extra Area of Effect for Energy and Fire spells', ranks: [] },
  { id: 64, name: 'Conflagrated Mind', parent: 2, branch: 'staff', description: 'While holding a staff, gain 1 extra Area of Effect and 25% cooldown reduction for Fire spells', ranks: [] },
  { id: 62, name: 'Electric Nature', parent: 2, branch: 'staff', description: 'Reduces the cooldown of spells by 15%', ranks: ['6%', '10%', '15%'] },
  { id: 63, name: 'Steering Insight', parent: 62, branch: 'staff', description: 'Energy and Arrow projectile spells bounce when colliding with enemies and explode on death', ranks: [] },
  { id: 65, name: 'Sacred Stick', parent: 1, branch: 'staff', description: 'While holding a staff, gain 1 extra Area of Effect and 25% cooldown reduction for Holy spells', ranks: [] },
  { id: 66, name: "Gallop's Fall", parent: 65, branch: 'staff', description: 'Reduces the cooldown of Water spells by 35%', ranks: [] },

  // ── Adaga ─────────────────────────────────────────────────────────────────
  { id: 10, name: 'Stabbing Preference', parent: 0, branch: 'dagger', description: 'Daggers provide Lifeleech', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 11, name: 'Thorough Puncture', parent: 10, branch: 'dagger', description: "Physical attacks ignore some of the target's armor", ranks: ['8%', '13%', '20%'] },
  { id: 12, name: 'Shearing Stroke', parent: 11, branch: 'dagger', description: 'Attacks have a chance of dealing 1.5x damage', ranks: ['10%', '14%', '20%'] },
  { id: 13, name: 'Luck Foreseen', parent: 12, branch: 'dagger', description: 'Converts 7 Ability into 1% chance of attacking twice', ranks: [] },
  { id: 14, name: 'Gaff Hack', parent: 11, branch: 'dagger', description: 'Casting a Mystic or Time spell has a chance of boosting your Attackspeed by 7 for 4s', ranks: ['20%', '30%', '50%'] },
  { id: 15, name: 'Double Danger', parent: 14, branch: 'dagger', description: 'Using two daggers doubles your Item Damage', ranks: [] },
  { id: 67, name: 'Jagged Rhythm', parent: 12, branch: 'dagger', description: 'Attacking using a dagger has a 50% chance of dealing extra (Ability/4) True Damage', ranks: [] },
  { id: 68, name: 'Luck Foreseen II', parent: 67, branch: 'dagger', description: 'Converts 6 Ability into 1% chance of attacking twice', ranks: [] },
  { id: 69, name: 'Dark Blade', parent: 68, branch: 'dagger', description: 'Doubles all True Damage you deal, but you also receive the True Damage dealt', ranks: [] },

  // ── Arco ──────────────────────────────────────────────────────────────────
  { id: 16, name: 'Bow Guidance', parent: 0, branch: 'bow', description: 'Bows have extra Attackspeed', ranks: ['1', '2', '3', '4', '6'] },
  { id: 17, name: 'Good Technique', parent: 16, branch: 'bow', description: 'Gain extra Range', ranks: ['1', '2', '4'] },
  { id: 18, name: 'Artisanal Arsenal', parent: 17, branch: 'bow', description: 'Non-magic arrows deal +7 Damage and break less often', ranks: ['7'] },
  { id: 19, name: 'Explosive Ammo', parent: 18, branch: 'bow', description: 'Arrows have a 25% chance of exploding dealing area damage that briefly slows', ranks: [] },
  { id: 20, name: 'Shineshooter', parent: 17, branch: 'bow', description: 'Reduces the cooldown of Arrow spells by 35%', ranks: ['10%', '20%', '35%'] },
  { id: 21, name: 'Bullseye', parent: 20, branch: 'bow', description: 'Increases the Damage of Arrow and Blade spells against enemies you have currently targeted', ranks: [] },
  { id: 70, name: 'Tunnelvision', parent: 21, branch: 'bow', description: 'Gain 10 Attackspeed, but you can no longer move while targeting an enemy', ranks: [] },

  // ── Luva (NOVO ramo — não existia na fonte antiga) ──────────────────────────
  { id: 71, name: 'Glove Passion', parent: 0, branch: 'glove', description: "While wearing gloves, gain 10 Mana or Health Regen depending on the item you're holding", ranks: [] },
  { id: 72, name: 'True Grip', parent: 71, branch: 'glove', description: 'While wearing Gloves, attacking regenerates Mana', ranks: ['1', '2', '4'] },
  { id: 73, name: 'Elvish Practice', parent: 72, branch: 'glove', description: 'Spells cost 15% less mana', ranks: ['6%', '10%', '15%'] },
  { id: 74, name: 'Arcane Trickster', parent: 73, branch: 'glove', description: 'While using Gloves, casting a Time or Mystic spell has a 50% chance of blocking all physical damage for 4 seconds', ranks: [] },
  { id: 75, name: 'Battle Mage', parent: 74, branch: 'glove', description: 'Converts 50 Max Mana into 1 extra True Damage', ranks: [] },
  { id: 76, name: 'One With Apogea', parent: 75, branch: 'glove', description: 'Mana damage is reduced in half, all spells cost 5 times more', ranks: [] },

  // ── Armadura Leve ────────────────────────────────────────────────────────
  { id: 25, name: 'Cozy and Useful', parent: 0, branch: 'lightarmor', description: 'Light Armor has extra mana', ranks: ['1', '3', '6', '10', '15'] },
  { id: 26, name: 'Breeze in Your Hair', parent: 25, branch: 'lightarmor', description: 'Not wearing a helmet gives you Movespeed', ranks: ['1', '2', '3'] },
  { id: 28, name: 'Battle Boots', parent: 26, branch: 'lightarmor', description: 'Converts 1 Movespeed into 1% chance of dealing 1.5x Damage', ranks: [] },
  { id: 27, name: 'Lightfoot', parent: 25, branch: 'lightarmor', description: 'Converts 10 Free Capacity into 1 Movespeed, capping at 3', ranks: [] },
  { id: 29, name: 'Dressing Wizardly', parent: 27, branch: 'lightarmor', description: 'Light Armor that weighs less than 35oz has Magic extra', ranks: ['1'] },
  { id: 30, name: 'Powerful Space', parent: 29, branch: 'lightarmor', description: 'Gain 5% Magic for each X Free Capacity you have, capping at 20%', ranks: ['50', '35', '15'] },
  { id: 31, name: 'Clothes of the Damned', parent: 30, branch: 'lightarmor', description: 'Removes negative effects from Light Armor and gain 5% Magic for each equipped Light Armor', ranks: [] },
  { id: 35, name: 'Darkness Embrace', parent: 31, branch: 'lightarmor', description: 'Death spells are 10 times cheaper. Heal, Light and Holy spells are 10 times more expensive', ranks: [] },

  // ── Escudo ───────────────────────────────────────────────────────────────
  { id: 32, name: 'Block Efficacy', parent: 0, branch: 'shield', description: 'Shields have more Defense', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 33, name: 'Bread and Butter', parent: 32, branch: 'shield', description: 'Using a sword and shield gives you extra damage', ranks: ['2', '4', '8'] },
  { id: 37, name: 'Shieldslam', parent: 33, branch: 'shield', description: 'Blocking an attack has a chance of staggering the attacker', ranks: ['7%', '10%', '15%'] },
  { id: 77, name: 'Rooted Guard', parent: 32, branch: 'shield', description: 'Blocking an attack regenerates 5 health', ranks: [] },
  { id: 78, name: 'Royal Shield', parent: 77, branch: 'shield', description: 'Reduces the cooldown of Defense spells by 35%', ranks: ['14%', '23%', '35%'] },
  { id: 79, name: 'Monster Candy', parent: 78, branch: 'shield', description: 'Taunt lasts 100% longer, Conjure and Defense spells cost 50% less mana, lose 99 damage', ranks: [] },
  { id: 38, name: 'Hex Parry', parent: 77, branch: 'shield', description: 'Successfully blocking an attack will empower your next Arrow or Blade spell by 50%', ranks: [] },
  { id: 34, name: 'Deflect', parent: 38, branch: 'shield', description: 'Blocking with a Magic Shield will reflect 35% of the damage taken, ignoring armor', ranks: ['35%'] },
  { id: 36, name: 'Bulwark Leap', parent: 38, branch: 'shield', description: 'While holding a shield, casting a Time or Physical spell will double your Magic Shield, capping at 200', ranks: [] },

  // ── Armadura Pesada ──────────────────────────────────────────────────────
  { id: 39, name: 'Well Protected', parent: 0, branch: 'heavyarmor', description: 'Heavy Armor has extra Health', ranks: ['1', '3', '6', '10', '15'] },
  { id: 40, name: 'Bulking Up', parent: 39, branch: 'heavyarmor', description: 'Gain Health for each equipped heavy armor', ranks: ['5', '10', '25'] },
  { id: 41, name: 'Heavy Metal', parent: 40, branch: 'heavyarmor', description: 'Heavy Armor that weighs more than 35oz has Ability extra', ranks: ['1'] },
  { id: 42, name: 'Carry Your Might', parent: 41, branch: 'heavyarmor', description: 'Converts 100 Max Capacity into 1 Armor, capping at 8', ranks: [] },
  { id: 98, name: 'Juggernaut', parent: 42, branch: 'heavyarmor', description: 'Removes negative effects from Heavy Armor and gain 5% Ability for each equipped Heavy Armor', ranks: [] },
  { id: 43, name: 'Royal Banner', parent: 39, branch: 'heavyarmor', description: 'Reduces the cooldown of Time and Heal spells by:', ranks: ['10%', '20%', '35%'] },
  { id: 44, name: 'Magic Steel', parent: 43, branch: 'heavyarmor', description: 'Casting a Time or Heal spell will give you a Magic Shield equal to a percentage of your total armor, capping at 100', ranks: ['75%', '100%', '150%'] },
  { id: 45, name: 'Blessed Plate', parent: 44, branch: 'heavyarmor', description: 'Heavy Armor has 1 Magic and 25 Mana extra', ranks: [] },
  { id: 46, name: 'Endowed in Steel', parent: 45, branch: 'heavyarmor', description: 'Attacking using both your hands gives you multiple stat boosts', ranks: [] },

  // ── Espada ───────────────────────────────────────────────────────────────
  { id: 47, name: 'Blade Training', parent: 0, branch: 'sword', description: 'Regular Swords have more Damage', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 51, name: 'Hand Finesse', parent: 47, branch: 'sword', description: 'Gain 1 Attackspeed for each X Ability you have capping at 5', ranks: ['15', '13', '10'] },
  { id: 53, name: 'Dual-Wielding', parent: 51, branch: 'sword', description: 'Size 6 swords have an equipsize of 5, but deal reduced Damage by:', ranks: ['40%', '36%', '30%'] },
  { id: 55, name: 'Fencing Classes', parent: 53, branch: 'sword', description: 'Blade spells cost 15% less mana', ranks: [] },
  { id: 90, name: 'Highlander', parent: 55, branch: 'sword', description: 'Blade spells cost 50% less mana, lose the ability to auto-attack. Additionally, converts 2 Attackspeed into 1 Damage', ranks: [] },
  { id: 52, name: 'Blade Prowess', parent: 51, branch: 'sword', description: 'While holding one sword of size 6 and no shield, reduces the cooldown of Blade spells by 50%', ranks: [] },
  { id: 54, name: 'To Be Ninja', parent: 52, branch: 'sword', description: 'Attacking has a 25% chance of boosting your Movespeed by 10 for 4 seconds', ranks: [] },

  // ── Arma Grande (NOVO ramo — machado/espada larga, antes misturado com Espada) ──
  { id: 80, name: 'Going Big', parent: 0, branch: 'largeweapon', description: 'Large Weapons have more Damage', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 81, name: 'Berserker', parent: 80, branch: 'largeweapon', description: 'Being below 66% Health gives you extra Damage', ranks: ['5', '8', '13'] },
  { id: 82, name: 'Overwhelming Force', parent: 81, branch: 'largeweapon', description: 'While using a Large Weapon, attacking has a 35% chance of casting an Area of Effect spell around the target', ranks: [] },
  { id: 83, name: 'Wrecking It', parent: 80, branch: 'largeweapon', description: 'Casting a Blade or Physical spell will make your next attack deal extra True Damage', ranks: ['6', '9', '14'] },
  { id: 84, name: 'Magic Blade', parent: 83, branch: 'largeweapon', description: 'Removes negative effects from Large Weapons and gain 10% Manaleech', ranks: [] },
  { id: 85, name: 'Unfathomable Rage', parent: 84, branch: 'largeweapon', description: 'Converts 2 Intake Damage into 1 Mana, doubles the cost of all spells', ranks: [] },

  // ── Orbe ─────────────────────────────────────────────────────────────────
  { id: 56, name: 'Pondering It', parent: 0, branch: 'orb', description: 'Orbs provide Spellvamp', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 57, name: 'Unnatural Flow', parent: 56, branch: 'orb', description: 'Your attacks will deal extra magic damage', ranks: ['4', '7', '12'] },
  { id: 60, name: 'Diamond Skin', parent: 57, branch: 'orb', description: 'Casting an Energy or Arrow spell will give you shield, stacking 3 times', ranks: ['20', '35', '50'] },
  { id: 61, name: 'Unstable Aegis', parent: 60, branch: 'orb', description: 'Taking shield damage will cast Unstable Berserk around yourself', ranks: [] },
  { id: 91, name: 'Magic Touch', parent: 56, branch: 'orb', description: 'While holding an Orb, Heal spells are 25% stronger', ranks: [] },
  { id: 92, name: "Apogea's Ardor", parent: 91, branch: 'orb', description: 'While holding an Orb, Heal spells cost 50% less mana', ranks: [] },
  { id: 93, name: "Child's Channel", parent: 92, branch: 'orb', description: 'Healing others also heals you, reduces the cooldown of all spells by 50%, and spells deal 75% less damage', ranks: [] },
];

// Requisito extra REAL confirmado (mesma lógica do código-fonte da calculadora antiga)
// pros talentos finais dos ramos que não mudaram de estrutura nessa atualização: além
// do pai direto no MÁXIMO, o nó-tronco do ramo também precisa estar maximizado. Não
// apliquei essa trava extra aos ramos novos/reorganizados (Luva, Arma Grande, Espada,
// Orbe, Armadura) porque não tenho confirmação de que ainda vale — eles usam só a
// trava básica (filho nunca ultrapassa o pai).
const EXTRA_REQUIREMENTS = {
  13: [[10, 5], [12, 3]],
  15: [[10, 5], [14, 3]],
  19: [[16, 5], [18, 3]],
  21: [[16, 5], [20, 3]],
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
// 2) Alguns talentos finais também exigem o nó-tronco do ramo maximizado (ver
//    EXTRA_REQUIREMENTS acima).
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
// reais (lifesteal, armorPen, crit, %dano, %armadura, attackspeed) vão em campos
// próprios; o resto cai no bônus genérico simplificado de sempre.
export function computeTalentModifiers(talentPoints, equipment) {
  const mods = {
    statBonuses: {},
    lifestealPercent: 0,
    armorPenPercent: 0,
    critChance: 0,
    critMultiplier: 1.5,
    damagePercent: 0,
    armorPercent: 0,
    trueDamageChance: 0,
    trueDamageAbilityDivisor: 0,
    doubleAttackAbilityDivisor: 0,
    trueDamageDoubled: false,
    staffFreeCastChance: 0,
    staffChargeDivisor: 0,
    franticConjuryChance: 0,
    spellCooldownReductionPercent: 0,
    fireCooldownReductionPercent: 0,
    holyCooldownReductionPercent: 0,
    waterCooldownReductionPercent: 0,
    fireEnergyDamageBonusPercent: 0,
    energyArrowDamageBonusPercent: 0,
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
      case 'trueDamageChance':
        mods.trueDamageChance = TRUE_DAMAGE_CHANCE;
        mods.trueDamageAbilityDivisor = TRUE_DAMAGE_ABILITY_DIVISOR;
        break;
      case 'doubleAttack':
        mods.doubleAttackAbilityDivisor = DOUBLE_ATTACK_ABILITY_DIVISOR;
        break;
      case 'trueDamageDouble':
        mods.trueDamageDoubled = true;
        break;
      case 'staffFreeCast':
        if (!Number.isNaN(rankValue)) mods.staffFreeCastChance = rankValue / 100;
        break;
      case 'staffCharge': {
        const divisor = parseMagicDivisor(talent.ranks[Math.min(points, talent.maxPoints) - 1]);
        if (!Number.isNaN(divisor)) mods.staffChargeDivisor = divisor;
        break;
      }
      case 'franticConjury':
        if (!Number.isNaN(rankValue)) mods.franticConjuryChance = rankValue / 100;
        break;
      case 'spellCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.spellCooldownReductionPercent = rankValue;
        break;
      case 'fireCooldownReduction':
        mods.fireCooldownReductionPercent = FIRE_CD_REDUCTION_PCT;
        break;
      case 'holyCooldownReduction':
        mods.holyCooldownReductionPercent = HOLY_CD_REDUCTION_PCT;
        break;
      case 'waterCooldownReduction':
        mods.waterCooldownReductionPercent = WATER_CD_REDUCTION_PCT;
        break;
      case 'elementalAoeBonus':
        mods.fireEnergyDamageBonusPercent = WARLOCK_DAMAGE_BONUS_PCT;
        break;
      case 'projectileBounceBonus':
        mods.energyArrowDamageBonusPercent = STEERING_INSIGHT_DAMAGE_BONUS_PCT;
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

  // Jagged Rhythm/Luck Foreseen II/Dark Blade (adaga): dependem do stat final de
  // Ability (já com todos os bônus aplicados), por isso são calculados aqui no fim,
  // não dentro de computeTalentModifiers.
  next.trueDamageChance = mods.trueDamageChance;
  next.trueDamagePerHit = mods.trueDamageAbilityDivisor ? next.ability / mods.trueDamageAbilityDivisor : 0;
  next.trueDamageDoubled = mods.trueDamageDoubled;
  next.doubleAttackChance = mods.doubleAttackAbilityDivisor
    ? Math.min(1, next.ability / mods.doubleAttackAbilityDivisor / 100)
    : 0;

  // Ramo Cajado: dependem do Magic final (staffChargeTrueDamage) ou só são flags/%
  // repassadas direto pro combate/SPELL_CAST usarem.
  next.staffFreeCastChance = mods.staffFreeCastChance;
  next.staffChargeTrueDamage = mods.staffChargeDivisor ? next.magic / mods.staffChargeDivisor : 0;
  next.franticConjuryChance = mods.franticConjuryChance;
  next.spellCooldownReductionPercent = mods.spellCooldownReductionPercent;
  next.fireCooldownReductionPercent = mods.fireCooldownReductionPercent;
  next.holyCooldownReductionPercent = mods.holyCooldownReductionPercent;
  next.waterCooldownReductionPercent = mods.waterCooldownReductionPercent;
  next.fireEnergyDamageBonusPercent = mods.fireEnergyDamageBonusPercent;
  next.energyArrowDamageBonusPercent = mods.energyArrowDamageBonusPercent;
  return next;
}
