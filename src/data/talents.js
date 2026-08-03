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

// Helpers de equipamento usados pelos talentos de Escudo/Armadura/Espada/Arma Grande
// que dependem de combinações específicas (peça+peça, peso, tamanho) além do requisito
// básico do ramo.
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'boots'];
function countArmorPieces(equipment, prefix) {
  return ARMOR_SLOTS.filter((slot) => equipment?.[slot]?.category?.startsWith(prefix)).length;
}
function hasArmorPieceWeightCondition(equipment, prefix, comparator, threshold) {
  return ARMOR_SLOTS.some((slot) => {
    const item = equipment?.[slot];
    if (!item?.category?.startsWith(prefix)) return false;
    const w = item.weight ?? 0;
    return comparator === 'under' ? w < threshold : w > threshold;
  });
}
const SHIELD_CATEGORIES = ['shield', 'lightshield', 'heavyshield', 'largeshield'];
function isDualWieldCategory(equipment, category) {
  return equipment?.weapon?.category === category && equipment?.offhand?.category === category;
}
function hasSwordAndShield(equipment) {
  return equipment?.weapon?.category === 'sword' && SHIELD_CATEGORIES.includes(equipment?.offhand?.category);
}
function hasBigSwordNoShield(equipment) {
  return equipment?.weapon?.category === 'sword' && (equipment.weapon.equipSize ?? 0) >= 6 && !SHIELD_CATEGORIES.includes(equipment?.offhand?.category);
}
function hasBothHandsFree(equipment) {
  return !!equipment?.weapon && !equipment?.offhand;
}
// Escudo equipado dá uma chance BASE de bloquear ataques do monstro — não é um valor
// documentado por nenhuma fonte real (nenhum talento CRIA o bloqueio, todos só
// melhoram um bloqueio que a wiki assume já existir por padrão), então é homebrew.
export const SHIELD_BASE_BLOCK_CHANCE = 0.15;
export function hasShieldEquipped(equipment) {
  return SHIELD_CATEGORIES.includes(equipment?.offhand?.category);
}

// Mecânicas REAIS implementadas de verdade (não é o bônus genérico) — cada uma lê o
// valor do rank atual (não é linear por ponto, é o valor real daquele rank específico).
// Os demais talentos (a maioria, presos a magias/efeitos que não existem aqui) caem no
// bônus genérico simplificado de sempre.
const MECHANICS = {
  10: 'lifesteal', // Stabbing Preference — Daggers provide Lifeleech (ataque físico)
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

  // Ramo Orbe — mesmo raciocínio: agora que existe sistema de magia real, essas
  // mecânicas ligam de verdade em vez do bônus genérico de Ability.
  56: 'spellLifesteal', // Pondering It — Spellvamp: cura baseada no DANO DE MAGIA (não no ataque físico)
  57: 'spellPowerBonus', // Unnatural Flow — soma um bônus fixo (4/7/12) na "Base Damage" das magias, igual mais Ability serve pro ataque físico
  60: 'diamondSkin', // Diamond Skin — conjurar magia de Energia dá escudo (20/35/50), empilha até 3x
  61: 'unstableAegis', // Unstable Aegis — quando o escudo absorve dano, estoura um "Unstable Berserk" homebrew no monstro
  91: 'healPowerBonus', // Magic Touch — com Orbe, magias de Cura curam 25% mais
  92: 'healManaDiscount', // Apogea's Ardor — com Orbe, magias de Cura custam 50% menos mana
  93: 'standby', // Child's Channel — combo complexo demais (cura em outros, etc.) — em standby por enquanto, sem efeito

  // ── Adaga (3 restantes) ──────────────────────────────────────────────────
  13: 'doubleAttackAlt', // Luck Foreseen — Ability/7 = % de ataque duplo (soma com Luck Foreseen II, que usa /6)
  14: 'castAttackBurst', // Gaff Hack — sem magia Mystic/Time nesse jogo: qualquer cast tem chance de dar 1 golpe extra grátis
  15: 'dualDaggerDamage', // Double Danger — duas adagas equipadas dobram o Dano

  // ── Arco ──────────────────────────────────────────────────────────────────
  17: 'bowCritChance', // Good Technique — sem Range nesse jogo: aproximado como chance de crítico extra
  18: 'bowFlatDamage', // Artisanal Arsenal — +7 de Dano fixo com arco equipado
  19: 'bowExplosiveChance', // Explosive Ammo — sem área de efeito: chance de dano bônus no golpe
  20: 'arrowCooldownReduction', // Shineshooter — reduz cooldown de magias tipo Arrow
  21: 'arrowBladeDamageBonus', // Bullseye — bônus de dano em magias Arrow/Blade (sem "alvo focado" real)
  70: 'flatAttackSpeed10', // Tunnelvision — +10 Attackspeed (sem a trava de não poder se mover, N/A no idle)

  // ── Luva — dados reais do cliente (traits.json), todos os valores por rank já são
  // os oficiais, não aproximação nossa (exceto onde marcado "homebrew").
  71: 'gloveHpRegen', // Glove Passion — +HP Regen com luvas (real: 1/2/4/6/10)
  72: 'gloveManaOnHitChance', // True Grip — chance de regenerar 3 Mana por golpe (real: 35/50/75%)
  73: 'globalManaDiscountGlove', // Elvish Practice — magias custam menos mana (real: 7/10/15%)
  74: 'gloveNextAttackTrueDamage', // Unnatural Flow (Luva) — cast de QUALQUER magia carrega o próximo golpe com Dano Verdadeiro (real: 5/7/10)
  75: 'martialArtsAttackSpeed', // Martial Arts — +Attackspeed (real: 1/2/4)
  76: 'arcaneTricksterShield', // Arcane Trickster — cast dá Escudo Mágico = MaxMana/10, cap 100 (real)
  100: 'standby', // Clear Drift — depende de Dash/Teleport, que não existem nesse jogo — em standby
  101: 'seerApparel', // Seer Apparel — Escudo Mágico absorve o dobro + golpes causam +5 Dano Verdadeiro fixo (real)
  102: 'gloveBattleMage', // Battle Mage (Luva) — golpes causam Dano Verdadeiro = Magic/3, capado em Damage/5+Defense (real)
  103: 'powerStance', // Power Stance — homebrew (descrição real não especifica os bônus)
  104: 'drunkStyle', // Drunk Style — Spellvamp fixo + chance de "Fire Breath" (magia não documentada, dano homebrew)
  105: 'supernaturalGamble', // Supernatural Gamble — magias -50% mana, 50% chance de explodir e causar dano em você mesmo (real)
  106: 'shapeOfWater', // Shape of Water — +5 AS, ataque gasta 3 mana por +5 Dano Verdadeiro, mas Mana vira 25 e Magic vira 5 (real, trade-off pesado)
  107: 'oneWithApogeaGlove', // One With Apogea (Luva) — Mana vira Dano Verdadeiro (1 a cada 35), mas zera o dano físico (real)

  // ── Armadura Leve ────────────────────────────────────────────────────────
  25: 'lightArmorMana', // Cozy and Useful — Armadura Leve dá mana extra (valor real do rank, não o genérico)
  26: 'noHelmetAttackSpeed', // Breeze in Your Hair — sem elmo, ganha Attackspeed (era Movespeed)
  27: 'freeCapacityAttackSpeed', // Lightfoot — capacidade livre vira Attackspeed (era Movespeed)
  28: 'battleBootsCrit', // Battle Boots — chance extra de crítico (era conversão de Movespeed)
  29: 'lightArmorWeightMagic', // Dressing Wizardly — peça leve <35oz dá Magic extra
  30: 'freeCapacityMagicPercent', // Powerful Space — capacidade livre vira % de Magic
  31: 'lightArmorCountMagicPercent', // Clothes of the Damned — % de Magic por peça de Armadura Leve equipada
  35: 'darknessEmbrace', // Darkness Embrace — magias de Death custam 10x menos, Heal/Light/Holy custam 10x mais

  // ── Escudo (Block Efficacy=32 e armorPercent já reais) ──────────────────────
  33: 'swordShieldDamage', // Bread and Butter — espada + escudo dá dano extra
  37: 'blockStagger', // Shieldslam — bloquear tem chance de atordoar o monstro (pula o próximo ataque dele)
  77: 'blockHeal', // Rooted Guard — bloquear regenera vida fixa
  78: 'defenseCooldownReduction', // Royal Shield — reduz cooldown de magias Defense
  79: 'monsterCandy', // Monster Candy — Conjure/Defense custam 50% menos mana, mas -99 de Dano
  38: 'blockEmpower', // Hex Parry — bloquear fortalece a próxima magia Arrow/Blade em 50%
  34: 'blockReflect', // Deflect — bloquear com Escudo Mágico ativo reflete dano verdadeiro no monstro
  36: 'physicalCastDoubleShield', // Bulwark Leap — conjurar magia Physical dobra o Escudo Mágico (cap 200)

  // ── Armadura Pesada ──────────────────────────────────────────────────────
  39: 'heavyArmorHealth', // Well Protected — Armadura Pesada dá vida extra (valor real do rank)
  40: 'heavyArmorCountHealth', // Bulking Up — vida extra por peça de Armadura Pesada equipada
  41: 'heavyArmorWeightAbility', // Heavy Metal — peça pesada >35oz dá Ability extra
  42: 'capacityToArmor', // Carry Your Might — capacidade máxima vira Armor (cap 8)
  98: 'heavyArmorCountAbilityPercent', // Juggernaut — % de Ability por peça de Armadura Pesada equipada
  43: 'healCooldownReduction', // Royal Banner — reduz cooldown de magias Heal (Time não existe nesse jogo)
  44: 'healCastShield', // Magic Steel — conjurar Heal dá Escudo Mágico (% da Armor, cap 100)
  45: 'heavyArmorFlatStats', // Blessed Plate — Armadura Pesada dá Magic e Mana fixos
  46: 'bothHandsBonus', // Endowed in Steel — usar as duas mãos livres (arma sem offhand) dá bônus de stats

  // ── Espada ───────────────────────────────────────────────────────────────
  51: 'abilityToAttackSpeed', // Hand Finesse — Ability vira Attackspeed (cap 5)
  52: 'bladeCooldownReductionBigSword', // Blade Prowess — espada tamanho 6 sem escudo reduz cooldown de magias Blade
  53: 'dualSwordPenalty', // Dual-Wielding — duas espadas tamanho 6 reduzem Dano (a troca de equipSize não é simulável)
  55: 'bladeManaDiscount', // Fencing Classes — magias Blade custam menos mana
  90: 'highlander', // Highlander — magias Blade custam 50% menos mana + Attackspeed vira Dano (sem desativar o ataque básico, por segurança)
  54: 'ninjaExtraHit', // To Be Ninja — chance de golpe extra (era boost de Movespeed)

  // ── Arma Grande ──────────────────────────────────────────────────────────
  81: 'berserkerLowHealth', // Berserker — abaixo de 66% de vida, dano extra
  82: 'overwhelmingForceChance', // Overwhelming Force — sem área de efeito: chance de dano bônus no golpe
  83: 'wreckingIt', // Wrecking It — conjurar Blade/Physical carrega o próximo golpe com Dano Verdadeiro extra
  84: 'manaLeech', // Magic Blade — Manaleech: recupera mana baseado no dano causado
  85: 'unfathomableRage', // Unfathomable Rage — dano recebido vira mana, mas dobra o custo de todas as magias
};

// Ramo Orbe: valores fixos dos talentos de 1 ponto só (fonte real não documenta rank
// diferente pra esses).
const HEAL_POWER_BONUS_PCT = 25;
const HEAL_MANA_DISCOUNT_PCT = 50;
export const DIAMOND_SKIN_MAX_STACKS = 3;
// "Unstable Berserk" não é uma das 34 magias documentadas — a descrição do talento só
// diz que ele é conjurado, sem fórmula. Aproximamos como um estouro de dano verdadeiro
// (ignora armadura) baseado no Magic, igual ao padrão de outras mecânicas homebrew.
export const UNSTABLE_AEGIS_MAGIC_DIVISOR = 4;

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

// Valores fixos dos talentos de 1 ponto só (ou com mecânica sem % na fonte) dos ramos
// Adaga/Arco/Luva/Escudo/Armadura/Espada/Arma Grande implementados nessa leva.
const DAGGER_DOUBLE_ATTACK_ALT_DIVISOR = 7; // Luck Foreseen: Ability/7 = % ataque duplo
const BOW_EXPLOSIVE_CHANCE = 0.25; // Explosive Ammo: 25% de chance (real)
const ARROW_BLADE_DAMAGE_BONUS_PCT = 20; // Bullseye: sem "alvo focado", bônus fixo homebrew
const BATTLE_BOOTS_CRIT_BONUS = 0.05; // Battle Boots: crítico extra homebrew (era conversão de Movespeed)
const CAPACITY_TO_ARMOR_DIVISOR = 100; // Carry Your Might: 100 Capacidade = 1 Armor
const CAPACITY_TO_ARMOR_CAP = 8;
const FREE_CAPACITY_ATTACK_SPEED_DIVISOR = 10; // Lightfoot: 10 capacidade livre = 1 Attackspeed
const FREE_CAPACITY_ATTACK_SPEED_CAP = 3;
export const DARKNESS_EMBRACE_DEATH_DISCOUNT_PCT = 90; // "10x mais barato" = -90% de custo
export const DARKNESS_EMBRACE_HEAL_SURCHARGE_PCT = 900; // "10x mais caro" = +900% de custo
const MONSTER_CANDY_DAMAGE_PENALTY = 99; // Monster Candy: "lose 99 damage" (real)
export const MONSTER_CANDY_MANA_DISCOUNT_PCT = 50; // real
export const BLOCK_EMPOWER_PCT = 50; // Hex Parry (real)
export const BLOCK_REFLECT_PCT = 35; // Deflect (real)
export const BULWARK_LEAP_SHIELD_CAP = 200; // real
const HEAVY_ARMOR_WEIGHT_ABILITY = 1; // Heavy Metal (real, peça >35oz)
const HEAVY_ARMOR_COUNT_ABILITY_PCT = 5; // Juggernaut (real, % por peça)
const HEAVY_ARMOR_FLAT_MAGIC = 1; // Blessed Plate (real)
const HEAVY_ARMOR_FLAT_MANA = 25; // Blessed Plate (real)
export const MAGIC_STEEL_SHIELD_CAP = 100; // real
const BOTH_HANDS_BONUS = 2; // Endowed in Steel: "múltiplos bônus de stats" — homebrew, +2 flat em Dano/Armor/Ability
const HAND_FINESSE_AS_CAP = 5; // real
export const HIGHLANDER_MANA_DISCOUNT_PCT = 50; // real
const HIGHLANDER_AS_TO_DAMAGE_DIVISOR = 2; // real: 2 Attackspeed = 1 Dano
const NINJA_EXTRA_HIT_CHANCE = 0.25; // To Be Ninja (real % — era boost de Movespeed)
export const BERSERKER_HEALTH_THRESHOLD_PCT = 66; // real
const OVERWHELMING_FORCE_CHANCE = 0.35; // real (sem área de efeito)
export const UNFATHOMABLE_RAGE_DAMAGE_TO_MANA_DIVISOR = 2; // real: 2 dano recebido = 1 mana
export const UNFATHOMABLE_RAGE_SPELL_COST_MULTIPLIER = 2; // real: dobra custo das magias

// Ramo Luva — valores reais confirmados no cliente (traits.json) pros nós de 1 ponto.
export const DRUNK_STYLE_SPELLVAMP_PCT = 10;
// "Fire Breath" não é uma das 34 magias documentadas com fórmula — sem valor de dano
// oficial, aproximado (homebrew) como uma explosão de dano fixo baseada no Dano médio.
export const DRUNK_STYLE_FIRE_BREATH_CHANCE = 0.35;
export const SEER_APPAREL_TRUE_DAMAGE = 5; // real
export const SHAPE_OF_WATER_ATTACK_SPEED = 5; // real
export const SHAPE_OF_WATER_MANA_COST = 3; // real
export const SHAPE_OF_WATER_TRUE_DAMAGE = 5; // real
export const SHAPE_OF_WATER_MANA_CAP = 25; // real
export const SHAPE_OF_WATER_MAGIC_CAP = 5; // real
export const SUPERNATURAL_GAMBLE_MANA_DISCOUNT_PCT = 50; // real
export const SUPERNATURAL_GAMBLE_SELF_DAMAGE_CHANCE = 0.5; // real
export const ONE_WITH_APOGEA_GLOVE_MANA_DIVISOR = 35; // real

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

  // ── Luva ─────────────────────────────────────────────────────────────────
  // Reconstruída do zero com dados extraídos DIRETO do cliente do jogo (Apogea 3.2.6,
  // scriptables_assets_traits — fonte: apogeawiki.info/data/traits.json, "authoritative":
  // true), bem melhor que a imagem da wiki usada antes. A árvore real tem 14 nós (a
  // versão anterior, com só 6, era um chute baseado numa fonte mais fraca — nomes,
  // valores por rank e até a estrutura de pré-requisito estavam errados).
  { id: 71, name: 'Glove Passion', parent: 0, branch: 'glove', description: 'Gloves have extra HP Regen', ranks: ['1', '2', '4', '6', '10'] },
  { id: 72, name: 'True Grip', parent: 71, branch: 'glove', description: 'While wearing Gloves, attacks have a chance of regenerating 3 Mana', ranks: ['35%', '50%', '75%'] },
  { id: 73, name: 'Elvish Practice', parent: 72, branch: 'glove', description: 'Spells cost less Mana', ranks: ['7%', '10%', '15%'] },
  { id: 74, name: 'Unnatural Flow', parent: 72, branch: 'glove', description: 'Casting a spell will make your next attack deal extra True Damage', ranks: ['5', '7', '10'] },
  { id: 75, name: 'Martial Arts', parent: 72, branch: 'glove', description: 'Gain extra Attackspeed', ranks: ['1', '2', '4'] },
  { id: 76, name: 'Arcane Trickster', parent: 73, branch: 'glove', description: 'Casting a Time or Mystic spell will give you a Magic Shield equal to (Max Mana / 10) capping at 100', ranks: [] },
  { id: 100, name: 'Clear Drift', parent: 73, branch: 'glove', description: 'Dashing or Teleporting will Cleanse one random debuff from you and heal units it passes by', ranks: [] },
  { id: 101, name: 'Seer Apparel', parent: 74, branch: 'glove', description: 'While wearing Gloves all Mana Shield damage is cut in half. Additionally, your attacks deal +5 True Damage', ranks: [] },
  { id: 102, name: 'Battle Mage', parent: 74, branch: 'glove', description: 'Your attacks will deal extra True Damage equal to (Magic / 3), capped at (Damage / 5 + Defense)', ranks: [] },
  { id: 103, name: 'Power Stance', parent: 75, branch: 'glove', description: 'Attacking using both your hands gives you multiple stat boosts', ranks: [] },
  { id: 104, name: 'Drunk Style', parent: 75, branch: 'glove', description: 'Attacking using both your hands gives you Spellvamp and a chance of casting "Fire Breath"', ranks: [] },
  { id: 105, name: 'Supernatural Gamble', parent: 76, branch: 'glove', description: 'Spells cost 50% less Mana, but have a 50% chance of blowing up dealing Damage to yourself equal to half its Mana cost', ranks: [] },
  { id: 106, name: 'Shape of Water', parent: 104, branch: 'glove', description: 'Gain +5 Attackspeed, additionally your attacks spend 3 Mana to deal +5 True Damage — but your Mana is set to 25 and Magic to 5', ranks: [] },
  { id: 107, name: 'One With Apogea', parent: 102, branch: 'glove', description: 'Gain +1 True Damage per 35 Mana points, but you no longer deal physical damage', ranks: [] },

  // ── Armadura Leve ────────────────────────────────────────────────────────
  { id: 25, name: 'Cozy and Useful', parent: 0, branch: 'lightarmor', description: 'Light Armor has extra mana', ranks: ['1', '3', '6', '10', '15'] },
  { id: 26, name: 'Breeze in Your Hair', parent: 25, branch: 'lightarmor', description: 'Not wearing a helmet gives you Movespeed', ranks: ['1', '2', '3'] },
  { id: 28, name: 'Battle Boots', parent: 26, branch: 'lightarmor', description: 'Converts 1 Movespeed into 1% chance of dealing 1.5x Damage', ranks: [] },
  { id: 27, name: 'Lightfoot', parent: 25, branch: 'lightarmor', description: 'Converts 10 Free Capacity into 1 Movespeed, capping at 3', ranks: [] },
  { id: 29, name: 'Dressing Wizardly', parent: 27, branch: 'lightarmor', description: 'Light Armor that weighs less than 35oz has Magic extra', ranks: ['1'] },
  // Mesmo problema: Dressing Wizardly (id29, pai) só tem 1 rank, então Powerful Space
  // nunca passava de 1/3 investindo tudo. Reduzido pro melhor valor (divisor menor =
  // mais % de Magic por capacidade livre).
  { id: 30, name: 'Powerful Space', parent: 29, branch: 'lightarmor', description: 'Gain 5% Magic for each X Free Capacity you have, capping at 20%', ranks: ['15'] },
  { id: 31, name: 'Clothes of the Damned', parent: 30, branch: 'lightarmor', description: 'Removes negative effects from Light Armor and gain 5% Magic for each equipped Light Armor', ranks: [] },
  { id: 35, name: 'Darkness Embrace', parent: 31, branch: 'lightarmor', description: 'Death spells are 10 times cheaper. Heal, Light and Holy spells are 10 times more expensive', ranks: [] },

  // ── Escudo ───────────────────────────────────────────────────────────────
  { id: 32, name: 'Block Efficacy', parent: 0, branch: 'shield', description: 'Shields have more Defense', ranks: ['1%', '4%', '8%', '14%', '20%'] },
  { id: 33, name: 'Bread and Butter', parent: 32, branch: 'shield', description: 'Using a sword and shield gives you extra damage', ranks: ['2', '4', '8'] },
  { id: 37, name: 'Shieldslam', parent: 33, branch: 'shield', description: 'Blocking an attack has a chance of staggering the attacker', ranks: ['7%', '10%', '15%'] },
  { id: 77, name: 'Rooted Guard', parent: 32, branch: 'shield', description: 'Blocking an attack regenerates 5 health', ranks: [] },
  // Mesmo problema: Rooted Guard (id77, pai) só tem 1 rank, então Royal Shield nunca
  // passava de 1/3 investindo tudo. Reduzido pro melhor valor.
  { id: 78, name: 'Royal Shield', parent: 77, branch: 'shield', description: 'Reduces the cooldown of Defense spells by 35%', ranks: ['35%'] },
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
// id 19 (Explosive Ammo) tinha uma trava aqui exigindo o pai (id18, Artisanal Arsenal)
// no nível 3 — mas id18 só tem 1 rank possível, então essa trava tornava o talento
// PERMANENTEMENTE inalcançável (bug real, achado por simulação). Removida — agora só
// vale a trava básica (filho nunca ultrapassa o pai), que já é suficiente aqui.
const EXTRA_REQUIREMENTS = {
  13: [[10, 5], [12, 3]],
  15: [[10, 5], [14, 3]],
  21: [[16, 5], [20, 3]],
  // Ramo Luva — pré-requisitos reais extraídos do cliente (traits.json): os 6 nós de
  // tier 4 exigem o pai direto MAXIMIZADO + Glove Passion também maximizado (não só
  // com 1 ponto, como a trava básica já garantiria); os 3 capstones de tier 5 exigem
  // os 2 nós de tier 4 do mesmo sub-ramo, ambos investidos.
  76: [[73, 3], [71, 5]],
  100: [[73, 3], [71, 5]],
  101: [[74, 3], [71, 5]],
  102: [[74, 3], [71, 5]],
  103: [[75, 3], [71, 5]],
  104: [[75, 3], [71, 5]],
  105: [[76, 1], [100, 1]],
  106: [[104, 1], [103, 1]],
  107: [[102, 1], [101, 1]],
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
    spellLifestealPercent: 0,
    spellPowerBonus: 0,
    diamondSkinValue: 0,
    unstableAegisActive: false,
    healPowerBonusPercent: 0,
    healManaDiscountPercent: 0,

    // Adaga (restante)
    doubleAttackAltDivisor: 0,
    castAttackBurstChance: 0,
    // Arco
    bowFlatDamage: 0,
    bowExplosiveChance: 0,
    arrowCooldownReductionPercent: 0,
    arrowBladeDamageBonusPercent: 0,
    // Luva
    gloveManaOnHitChance: 0,
    globalManaDiscountPercent: 0,
    gloveNextAttackTrueDamage: 0,
    arcaneTricksterShieldActive: false,
    seerApparelActive: false,
    gloveBattleMageActive: false,
    powerStanceActive: false,
    drunkStyleActive: false,
    supernaturalGambleActive: false,
    shapeOfWaterActive: false,
    oneWithApogeaGloveActive: false,
    // Armadura Leve
    freeCapacityAttackSpeedActive: false,
    freeCapacityMagicThresholdDivisor: 0,
    magicPercent: 0,
    darknessEmbraceActive: false,
    // Escudo
    blockStaggerChance: 0,
    blockHealFlat: 0,
    defenseCooldownReductionPercent: 0,
    monsterCandyActive: false,
    blockEmpowerActive: false,
    blockReflectActive: false,
    physicalCastDoubleShieldActive: false,
    // Armadura Pesada
    capacityToArmorActive: false,
    abilityPercent: 0,
    healCooldownReductionPercent: 0,
    healCastShieldPercent: 0,
    // Espada
    abilityToAttackSpeedDivisor: 0,
    bladeCooldownReductionBigSwordActive: false,
    bladeManaDiscountPercent: 0,
    highlanderActive: false,
    ninjaExtraHitChance: 0,
    // Arma Grande
    berserkerBonusDamage: 0,
    overwhelmingForceChance: 0,
    wreckingItBonus: 0,
    manaLeechPercent: 0,
    unfathomableRageActive: false,
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
      case 'spellLifesteal':
        if (!Number.isNaN(rankValue)) mods.spellLifestealPercent += rankValue;
        break;
      case 'spellPowerBonus':
        if (!Number.isNaN(rankValue)) mods.spellPowerBonus += rankValue;
        break;
      case 'diamondSkin':
        if (!Number.isNaN(rankValue)) mods.diamondSkinValue = rankValue;
        break;
      case 'unstableAegis':
        mods.unstableAegisActive = true;
        break;
      case 'healPowerBonus':
        mods.healPowerBonusPercent = HEAL_POWER_BONUS_PCT;
        break;
      case 'healManaDiscount':
        mods.healManaDiscountPercent = HEAL_MANA_DISCOUNT_PCT;
        break;
      case 'standby':
        break;

      // ── Adaga ────────────────────────────────────────────────────────────
      case 'doubleAttackAlt':
        mods.doubleAttackAltDivisor = DAGGER_DOUBLE_ATTACK_ALT_DIVISOR;
        break;
      case 'castAttackBurst':
        if (!Number.isNaN(rankValue)) mods.castAttackBurstChance = rankValue / 100;
        break;
      case 'dualDaggerDamage':
        if (isDualWieldCategory(equipment, 'dagger')) mods.damagePercent += 100;
        break;

      // ── Arco ─────────────────────────────────────────────────────────────
      case 'bowCritChance':
        if (!Number.isNaN(rankValue)) mods.critChance += rankValue / 100;
        break;
      case 'bowFlatDamage':
        mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + (points > 0 ? 7 : 0);
        break;
      case 'bowExplosiveChance':
        mods.bowExplosiveChance = BOW_EXPLOSIVE_CHANCE;
        break;
      case 'arrowCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.arrowCooldownReductionPercent = rankValue;
        break;
      case 'arrowBladeDamageBonus':
        mods.arrowBladeDamageBonusPercent = ARROW_BLADE_DAMAGE_BONUS_PCT;
        break;
      case 'flatAttackSpeed10':
        mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + 10;
        break;

      // ── Luva ─────────────────────────────────────────────────────────────
      case 'gloveHpRegen':
        if (!Number.isNaN(rankValue)) mods.statBonuses.hpRegen = (mods.statBonuses.hpRegen ?? 0) + rankValue;
        break;
      case 'gloveManaOnHitChance':
        if (!Number.isNaN(rankValue)) mods.gloveManaOnHitChance = rankValue / 100;
        break;
      case 'globalManaDiscountGlove':
        if (!Number.isNaN(rankValue)) mods.globalManaDiscountPercent += rankValue;
        break;
      case 'gloveNextAttackTrueDamage':
        if (!Number.isNaN(rankValue)) mods.gloveNextAttackTrueDamage = rankValue;
        break;
      case 'martialArtsAttackSpeed':
        if (!Number.isNaN(rankValue)) mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + rankValue;
        break;
      case 'arcaneTricksterShield':
        mods.arcaneTricksterShieldActive = true;
        break;
      case 'seerApparel':
        mods.seerApparelActive = true;
        break;
      case 'gloveBattleMage':
        mods.gloveBattleMageActive = true;
        break;
      // Power Stance/Drunk Style: "attacking using both your hands" = sem item na mão
      // secundária (offhand vazio) enquanto usa luvas — mesmo padrão do Endowed in
      // Steel (Armadura Pesada).
      case 'powerStance':
        if (hasBothHandsFree(equipment)) {
          mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + BOTH_HANDS_BONUS;
          mods.statBonuses.armor = (mods.statBonuses.armor ?? 0) + BOTH_HANDS_BONUS;
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + BOTH_HANDS_BONUS;
        }
        break;
      case 'drunkStyle':
        if (hasBothHandsFree(equipment)) {
          mods.spellLifestealPercent += DRUNK_STYLE_SPELLVAMP_PCT;
          mods.drunkStyleActive = true;
        }
        break;
      case 'supernaturalGamble':
        mods.supernaturalGambleActive = true;
        break;
      case 'shapeOfWater':
        mods.shapeOfWaterActive = true;
        mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + SHAPE_OF_WATER_ATTACK_SPEED;
        break;
      case 'oneWithApogeaGlove':
        mods.oneWithApogeaGloveActive = true;
        break;

      // ── Armadura Leve ────────────────────────────────────────────────────
      case 'lightArmorMana':
        if (!Number.isNaN(rankValue)) mods.statBonuses.mana = (mods.statBonuses.mana ?? 0) + rankValue;
        break;
      case 'noHelmetAttackSpeed':
        if (!Number.isNaN(rankValue) && !equipment?.head) {
          mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + rankValue;
        }
        break;
      case 'freeCapacityAttackSpeed':
        mods.freeCapacityAttackSpeedActive = true;
        break;
      case 'battleBootsCrit':
        mods.critChance += BATTLE_BOOTS_CRIT_BONUS;
        break;
      case 'lightArmorWeightMagic':
        if (hasArmorPieceWeightCondition(equipment, 'light', 'under', 35)) {
          mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + 1;
        }
        break;
      case 'freeCapacityMagicPercent':
        if (!Number.isNaN(rankValue)) mods.freeCapacityMagicThresholdDivisor = rankValue;
        break;
      case 'lightArmorCountMagicPercent':
        mods.magicPercent += countArmorPieces(equipment, 'light') * 5;
        break;
      case 'darknessEmbrace':
        mods.darknessEmbraceActive = true;
        break;

      // ── Escudo ───────────────────────────────────────────────────────────
      case 'swordShieldDamage':
        if (!Number.isNaN(rankValue) && hasSwordAndShield(equipment)) {
          mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + rankValue;
        }
        break;
      case 'blockStagger':
        if (!Number.isNaN(rankValue)) mods.blockStaggerChance = rankValue / 100;
        break;
      case 'blockHeal':
        mods.blockHealFlat = 5;
        break;
      case 'defenseCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.defenseCooldownReductionPercent = rankValue;
        break;
      case 'monsterCandy':
        mods.monsterCandyActive = true;
        mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) - MONSTER_CANDY_DAMAGE_PENALTY;
        break;
      case 'blockEmpower':
        mods.blockEmpowerActive = true;
        break;
      case 'blockReflect':
        mods.blockReflectActive = true;
        break;
      case 'physicalCastDoubleShield':
        mods.physicalCastDoubleShieldActive = true;
        break;

      // ── Armadura Pesada ──────────────────────────────────────────────────
      case 'heavyArmorHealth':
        if (!Number.isNaN(rankValue)) mods.statBonuses.health = (mods.statBonuses.health ?? 0) + rankValue;
        break;
      case 'heavyArmorCountHealth':
        if (!Number.isNaN(rankValue)) {
          mods.statBonuses.health = (mods.statBonuses.health ?? 0) + rankValue * countArmorPieces(equipment, 'heavy');
        }
        break;
      case 'heavyArmorWeightAbility':
        if (hasArmorPieceWeightCondition(equipment, 'heavy', 'over', 35)) {
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + HEAVY_ARMOR_WEIGHT_ABILITY;
        }
        break;
      case 'capacityToArmor':
        mods.capacityToArmorActive = true;
        break;
      case 'heavyArmorCountAbilityPercent':
        mods.abilityPercent += countArmorPieces(equipment, 'heavy') * HEAVY_ARMOR_COUNT_ABILITY_PCT;
        break;
      case 'healCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.healCooldownReductionPercent = rankValue;
        break;
      case 'healCastShield':
        if (!Number.isNaN(rankValue)) mods.healCastShieldPercent = rankValue;
        break;
      case 'heavyArmorFlatStats':
        mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + HEAVY_ARMOR_FLAT_MAGIC;
        mods.statBonuses.mana = (mods.statBonuses.mana ?? 0) + HEAVY_ARMOR_FLAT_MANA;
        break;
      case 'bothHandsBonus':
        if (hasBothHandsFree(equipment)) {
          mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + BOTH_HANDS_BONUS;
          mods.statBonuses.armor = (mods.statBonuses.armor ?? 0) + BOTH_HANDS_BONUS;
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + BOTH_HANDS_BONUS;
        }
        break;

      // ── Espada ───────────────────────────────────────────────────────────
      case 'abilityToAttackSpeed':
        if (!Number.isNaN(rankValue)) mods.abilityToAttackSpeedDivisor = rankValue;
        break;
      case 'bladeCooldownReductionBigSword':
        if (hasBigSwordNoShield(equipment)) mods.bladeCooldownReductionBigSwordActive = true;
        break;
      case 'dualSwordPenalty':
        if (!Number.isNaN(rankValue) && isDualWieldCategory(equipment, 'sword')) mods.damagePercent -= rankValue;
        break;
      case 'bladeManaDiscount':
        mods.bladeManaDiscountPercent += 15;
        break;
      case 'highlander':
        mods.highlanderActive = true;
        break;
      case 'ninjaExtraHit':
        mods.ninjaExtraHitChance = NINJA_EXTRA_HIT_CHANCE;
        break;

      // ── Arma Grande ──────────────────────────────────────────────────────
      case 'berserkerLowHealth':
        if (!Number.isNaN(rankValue)) mods.berserkerBonusDamage = rankValue;
        break;
      case 'overwhelmingForceChance':
        mods.overwhelmingForceChance = OVERWHELMING_FORCE_CHANCE;
        break;
      case 'wreckingIt':
        if (!Number.isNaN(rankValue)) mods.wreckingItBonus = rankValue;
        break;
      case 'manaLeech':
        mods.manaLeechPercent = 10;
        break;
      case 'unfathomableRage':
        mods.unfathomableRageActive = true;
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
  const equipment = character?.equipment;

  // Powerful Space (Armadura Leve): % de Magic escalado pela capacidade LIVRE (Capacity
  // final - peso carregado na mochila) — precisa do stat final de Capacity, por isso é
  // resolvido aqui e somado no mods.magicPercent antes de aplicar o multiplicador.
  if (mods.freeCapacityMagicThresholdDivisor) {
    const invWeight = (character?.inventory ?? []).reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0);
    const freeCapacity = Math.max(0, next.capacity - invWeight);
    mods.magicPercent += Math.min(20, Math.floor(freeCapacity / mods.freeCapacityMagicThresholdDivisor) * 5);
  }

  for (const [key, val] of Object.entries(mods.statBonuses)) {
    next[key] = Math.round(((next[key] ?? 0) + val) * 100) / 100;
  }
  if (mods.damagePercent) next.damage = Math.round(next.damage * (1 + mods.damagePercent / 100) * 100) / 100;
  if (mods.armorPercent) next.armor = Math.round(next.armor * (1 + mods.armorPercent / 100) * 100) / 100;
  if (mods.magicPercent) next.magic = Math.round(next.magic * (1 + mods.magicPercent / 100) * 100) / 100;
  if (mods.abilityPercent) next.ability = Math.round(next.ability * (1 + mods.abilityPercent / 100) * 100) / 100;

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
  // Luck Foreseen (13, /7) e Luck Foreseen II (68, /6) são caminhos PARALELOS do mesmo
  // ramo — se o jogador investiu nos dois, as chances somam (cada Ability conta pras
  // duas fontes independentemente).
  const doubleAttackFromMain = mods.doubleAttackAbilityDivisor ? next.ability / mods.doubleAttackAbilityDivisor / 100 : 0;
  const doubleAttackFromAlt = mods.doubleAttackAltDivisor ? next.ability / mods.doubleAttackAltDivisor / 100 : 0;
  next.doubleAttackChance = Math.min(1, doubleAttackFromMain + doubleAttackFromAlt);

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

  // Ramo Orbe
  next.spellLifestealPercent = mods.spellLifestealPercent;
  next.spellPowerBonus = mods.spellPowerBonus;
  next.diamondSkinValue = mods.diamondSkinValue;
  next.unstableAegisActive = mods.unstableAegisActive;
  next.healPowerBonusPercent = mods.healPowerBonusPercent;
  next.healManaDiscountPercent = mods.healManaDiscountPercent;

  // ── Adaga (restante) ─────────────────────────────────────────────────────
  next.castAttackBurstChance = mods.castAttackBurstChance;

  // ── Arco ─────────────────────────────────────────────────────────────────
  next.bowExplosiveChance = mods.bowExplosiveChance;
  next.arrowCooldownReductionPercent = mods.arrowCooldownReductionPercent;
  next.arrowBladeDamageBonusPercent = mods.arrowBladeDamageBonusPercent;

  // ── Luva ─────────────────────────────────────────────────────────────────
  next.gloveManaOnHitChance = mods.gloveManaOnHitChance;
  next.globalManaDiscountPercent = mods.globalManaDiscountPercent;
  next.gloveNextAttackTrueDamage = mods.gloveNextAttackTrueDamage;
  // Arcane Trickster: Escudo Mágico = Mana máxima final / 10, cap 100.
  next.arcaneTricksterShieldGain = mods.arcaneTricksterShieldActive ? Math.min(MAGIC_STEEL_SHIELD_CAP, next.mana / 10) : 0;
  next.seerApparelActive = mods.seerApparelActive;
  // Battle Mage (Luva): Dano Verdadeiro = Magic/3, capado em Damage/5 + Defense (final).
  next.gloveBattleMageDamage = mods.gloveBattleMageActive
    ? Math.min(next.magic / 3, next.damage / 5 + next.defense)
    : 0;
  next.drunkStyleActive = mods.drunkStyleActive;
  next.supernaturalGambleActive = mods.supernaturalGambleActive;
  next.shapeOfWaterActive = mods.shapeOfWaterActive;
  next.oneWithApogeaGloveActive = mods.oneWithApogeaGloveActive;

  // ── Armadura Leve ────────────────────────────────────────────────────────
  if (mods.freeCapacityAttackSpeedActive) {
    const invWeight = (character?.inventory ?? []).reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0);
    const freeCapacity = Math.max(0, next.capacity - invWeight);
    next.attackSpeed = Math.round(
      (next.attackSpeed + Math.min(FREE_CAPACITY_ATTACK_SPEED_CAP, Math.floor(freeCapacity / FREE_CAPACITY_ATTACK_SPEED_DIVISOR))) * 100,
    ) / 100;
  }
  next.darknessEmbraceActive = mods.darknessEmbraceActive;

  // ── Escudo ───────────────────────────────────────────────────────────────
  next.hasShieldEquipped = hasShieldEquipped(equipment);
  next.blockChance = next.hasShieldEquipped ? SHIELD_BASE_BLOCK_CHANCE : 0;
  next.blockStaggerChance = mods.blockStaggerChance;
  next.blockHealFlat = mods.blockHealFlat;
  next.defenseCooldownReductionPercent = mods.defenseCooldownReductionPercent;
  next.monsterCandyActive = mods.monsterCandyActive;
  next.blockEmpowerActive = mods.blockEmpowerActive;
  next.blockReflectActive = mods.blockReflectActive;
  next.physicalCastDoubleShieldActive = mods.physicalCastDoubleShieldActive;

  // ── Armadura Pesada ──────────────────────────────────────────────────────
  if (mods.capacityToArmorActive) {
    next.armor = Math.round((next.armor + Math.min(CAPACITY_TO_ARMOR_CAP, Math.floor(next.capacity / CAPACITY_TO_ARMOR_DIVISOR))) * 100) / 100;
  }
  next.healCooldownReductionPercent = mods.healCooldownReductionPercent;
  next.healCastShieldPercent = mods.healCastShieldPercent;

  // ── Espada ───────────────────────────────────────────────────────────────
  if (mods.abilityToAttackSpeedDivisor) {
    next.attackSpeed = Math.round(
      (next.attackSpeed + Math.min(HAND_FINESSE_AS_CAP, Math.floor(next.ability / mods.abilityToAttackSpeedDivisor))) * 100,
    ) / 100;
  }
  next.bladeCooldownReductionBigSwordActive = mods.bladeCooldownReductionBigSwordActive;
  next.bladeManaDiscountPercent = mods.bladeManaDiscountPercent;
  next.highlanderActive = mods.highlanderActive;
  if (mods.highlanderActive) {
    next.damage = Math.round((next.damage + Math.floor(next.attackSpeed / HIGHLANDER_AS_TO_DAMAGE_DIVISOR)) * 100) / 100;
  }
  next.ninjaExtraHitChance = mods.ninjaExtraHitChance;

  // ── Arma Grande ──────────────────────────────────────────────────────────
  next.berserkerBonusDamage = mods.berserkerBonusDamage;
  next.overwhelmingForceChance = mods.overwhelmingForceChance;
  next.wreckingItBonus = mods.wreckingItBonus;
  next.manaLeechPercent = mods.manaLeechPercent;
  next.unfathomableRageActive = mods.unfathomableRageActive;

  return next;
}
