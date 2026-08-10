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
  // ── Cajado (ids 200-213) ─ dados reais do cliente (traits.json) ───────────
  200: 'staffTrueDamage', // Staff Mastery — Staves/Wands dão +X Dano Verdadeiro fixo (real)
  201: 'staffChargePct', // Charge the Stick — cast Elemental carrega o próximo golpe com X% da Mana gasta em Dano Verdadeiro (real)
  202: 'franticConjury', // Frantic Conjury — acertar magia de Fogo/Energia tem chance de conjurar Conjure Fire de graça no próximo golpe (real, ampliado pra Fogo OU Energia)
  203: 'standby', // Charged Body — depende de "Conjure Energy"/"Charged Ground", magias não documentadas — sem efeito
  204: 'fireFlatDamage', // Conflagrated Mind — magias de Fogo +10 de dano base + AoE (agora ativa: 1 alvo extra)
  205: 'earthWaterCooldownReduction', // Gallop's Fall — reduz cooldown de Terra e Água (real, Gallop's Fall antes só cobria Água)
  206: 'standby', // Geomancer — depende de "estar na água" e magias Geyser/Rock Shield não documentadas — sem efeito
  207: 'standby', // Serene Retribution — depende de "Water Wave", magia não documentada — sem efeito
  208: 'attackSpeedFlat', // Wizard Studies — Cajado/Varinha +Attackspeed fixo (real)
  209: 'timeCooldownReduction', // Chrono Conversion — só a parte "reduz cooldown de magias Time/Mystic em 35%" está ativa (real, agora que Quick Attack existe); a parte "+15 Magic com 5+ Movespeed extra" continua sem efeito, sem sistema de Movespeed
  210: 'magicThresholdAttackSpeed', // Shift Wardens — +5 AS se Magic final >=15 (real, parte de Dash/Teleport pulada — não existem aqui)
  211: 'chosenOne', // Chosen One — +15 Magic +15 Ability fixos (real; "monstros miram 50% mais" não tem efeito, não existe sistema de mira)
  212: 'friendOfApogea', // Friend of Apogea — Terra/Água/Luz custam 35% menos mana, mas todo dano de magia -25% (real)
  213: 'warlockNew', // Warlock — todo dano de magia +25%, cura -50% mais fraca (real; "não pode curar outros" N/A, sem multiplayer)

  // ── Adaga (ids 220-233) ────────────────────────────────────────────────────
  220: 'lifesteal', // Stabbing Preference — Adagas dão Lifeleech (real)
  221: 'abilityToAttackSpeed', // Hand Finesse — Ability vira Attackspeed, cap 5 (real)
  222: 'castAttackBurst', // Gaff Hack — sem magia Time/Mystic aqui: qualquer cast tem chance de dar 1 golpe extra grátis (homebrew, reaproveita mecânica antiga)
  223: 'standby', // Slash And Dash — depende de Backstab (posição atrás do alvo), não existe aqui — sem efeito
  224: 'standby', // Tendon Cut — mesmo motivo (Backstab) — sem efeito
  225: 'daggerExtraHitOnAttack', // Jagged Rhythm — golpe de adaga tem chance de dar 1 golpe extra (homebrew: era buff de Attackspeed temporário, sem timers aqui vira golpe extra na hora)
  226: 'foreseenDecay', // Foreseen Decay — +5 Dano Verdadeiro fixo, 15% de chance de dobrar (real)
  227: 'poisonShiv', // Poison Shiv — +5 Dano Verdadeiro fixo (real; explosão em morte pulada, 1 alvo só)
  228: 'sweetSpotFlatDamage', // Sweet Spot — sem Range/Distância aqui: bônus de dano fixo sempre ativo (homebrew, adaga é corpo a corpo = "sempre perto")
  229: 'standby', // Chunk Sampling — depende de "atordoar" (stagger), sistema que não existe — sem efeito
  230: 'standby', // Monster Meat — depende de aliados próximos, sem multiplayer — sem efeito
  231: 'darkBladePlus', // Dark Blade — dobra Dano Verdadeiro (e você recebe também) + golpes dão +3 Mana (real)
  232: 'dualDaggerDamage', // Double Danger — duas adagas dobram o Dano (real; "reduz outros stats à metade" pulado, complexo demais)
  233: 'standby', // Gourmand — depende de sistema de comida com buffs temporizados e Movespeed, incompatível com o sistema de saciedade daqui — sem efeito

  // ── Arco (ids 240-253) ──────────────────────────────────────────────────────
  240: 'attackSpeedFlat', // Bow Guidance — Arco/Besta +Attackspeed fixo (real)
  241: 'bowFlatDamageRanked', // Good Technique — sem Range aqui: bônus de dano fixo sempre ativo (homebrew, arco é à distância = "sempre longe")
  242: 'bowFlatDamage2', // Artisanal Arsenal — +dano fixo (real; chance de recuperar munição pulada, sem sistema de flechas)
  243: 'bowExplosiveChance', // Explosive Ammo — sem área de efeito: chance de dano bônus no golpe (homebrew, reaproveita mecânica antiga)
  244: 'bowSecondaryProcChance', // Mahogany Build — mesmo raciocínio de Explosive Ammo, chance de dano bônus separada (homebrew)
  245: 'timeManaDiscount', // Meditation — magias Time custam menos mana (real, agora que Quick Attack existe)
  246: 'standby', // Chasing Prey — depende de Movespeed — sem efeito
  247: 'standby', // Hunt Prep — depende de magia Time/Mystic e "Grand Trap" não documentada — sem efeito
  248: 'arrowExtraHitChance', // Swiftstride — cast de magia tipo Arrow tem chance de dar 1 golpe extra (homebrew: era cast de "Haste", sem timers vira golpe extra na hora)
  249: 'arrowBladeTrueDamage', // Bullseye — magia Arrow/Blade acerta = +2×(Ability/3) Dano Verdadeiro (real; "dobrado se for o alvo atual" sempre vale aqui, só existe 1 alvo)
  250: 'arrowBladeHeal', // Deferred Reverence — magia Arrow/Blade acerta = cura 2×(Magic/3) (real, mesmo raciocínio do dobro)
  251: 'standby', // Improvised Sentry — depende de sistema de invocação, que não existe — sem efeito
  252: 'standby', // Mother's Embrace — conjurar 2x com metade do dano cada é matematicamente neutro no nosso modelo de 1 dano por cast — sem efeito prático, não implementado
  253: 'attackSpeedFlat12', // Tunnelvision — +12 Attackspeed fixo (real; trava de não poder se mover é N/A no idle)

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

  // ── Armadura Leve (ids 260-273) ──────────────────────────────────────────
  260: 'lightArmorMana', // Cozy and Useful — Armadura Leve dá mana extra (real)
  261: 'lightArmorCapacity', // Lightfoot — +Capacidade Máxima fixa (real; parte de Movespeed pulada)
  262: 'lightArmorNoHelmetHpRegen', // Breeze in Your Hair — sem elmo, ganha HP Regen (real; parte de Movespeed pulada)
  263: 'battleBootsCrit', // Battle Boots — chance extra de crítico (homebrew, era conversão de Movespeed)
  264: 'adventurersSpirit', // Adventurer's Spirit — Magic/Ability por 100 de Capacidade Máxima, cap 10 cada (real; "Backpacks não dão mais stats" pulado)
  265: 'skalsfeetNoBoots', // Skalsfeet — sem botas, múltiplos bônus de stats (homebrew, real não especifica os valores)
  266: 'dressingWizardly2', // Dressing Wizardly — Armadura Leve dá Magic e Mana Regen fixos (real)
  267: 'clothesOfTheDamned2', // Clothes of the Damned — +10 Magic +10% Spellvamp com 3+ Armadura Leve (real; remoção de stats negativos pulada)
  268: 'standby', // Relic Affinity — mexeria na forma como stats de item escalam com a classe, complexo/arriscado demais pra retrofit — sem efeito
  269: 'mercColorsNegativeStat', // Merc Colors — peça de Armadura Leve com stat negativo dá +Ability (real)
  270: 'standby', // Quicken Mismatch — depende de "Surge", magia não documentada — sem efeito
  271: 'standby', // Razor Sprint — depende de Dash/Teleport, que não existem aqui — sem efeito
  272: 'darknessEmbrace', // Darkness Embrace — magias de Death custam 10x menos, Heal/Light/Holy custam 10x mais (real)
  273: 'masqueAllStats', // Masque of Elgifu — +1 em todos os stats (real; traje de bobo da corte é só visual, N/A)

  // ── Escudo (ids 280-292) ─────────────────────────────────────────────────
  280: 'armorPercent', // Block Efficacy — Escudos dão mais Defesa (real)
  281: 'standby', // Loud Presence — "monstros miram mais em você" não tem efeito, sem sistema de mira — sem efeito (nó estrutural, só destrava os filhos)
  282: 'shieldManaRegen', // Rooted Guard — segurar Escudo dá Mana Regen (real; era cura por bloqueio antes, agora é regen passivo)
  283: 'standby', // Elemental Plate — buff vago "baseado no elemento", sem fórmula — sem efeito
  284: 'etchedGemsShield', // Etched Gems — gastar mais de 50% da Mana máxima num cast dá +20 Escudo Mágico (real)
  285: 'defenseConjureCooldownReduction', // Royal Attire — reduz cooldown de Defense e Conjure (real, ampliado pra incluir Conjure)
  286: 'tauntAoe', // Divine Pull — só a parte "Taunt gains +1 Area of Effect" está ativa (+1 alvo extra); o cast de "Divine Pull"/debuff de Movespeed continua sem efeito, sem dados/sistema de Movespeed
  287: 'standby', // Guard Training — depende de "Knight's Vow", não documentada — sem efeito
  288: 'shieldFlatDamage', // Swing Maneuver — Escudos dão Dano extra fixo (real)
  289: 'standby', // Bulwark Leap — agora depende de Dash/Teleport (mudou de mecânica) — sem efeito
  290: 'standby', // Shield Throw — depende de Range e magia não documentada — sem efeito
  291: 'innervatedMana', // Innervated Mana — dano recebido vira Mana (2:1), mas lançar magia zera a Mana (real, risco/recompensa)
  292: 'standby', // Stricken Devotion — depende de decaimento de Escudo Mágico ao longo do tempo, sistema que não existe aqui — sem efeito

  // ── Armadura Pesada (ids 320-333) ────────────────────────────────────────
  320: 'heavyArmorHealth', // Well Protected — Armadura Pesada dá vida extra (real)
  321: 'heavyArmorCapacityRegen', // Carry your Might — Armadura Pesada dá Capacidade Máxima e HP Regen fixos (real)
  322: 'heavyArmorAbility', // Heavy Metal — Armadura Pesada dá Ability fixo (real)
  323: 'heavyArmorCountLifeleech', // Juggernaut — +10 Ability +10% Lifeleech com 3+ Armadura Pesada (real; remoção de stats negativos pulada)
  324: 'loomingDreadTrueDmg', // Looming Dread — +1 Dano Verdadeiro a cada 10 de Armor (real)
  325: 'healLightFlatDiscount', // Royal Marks — magias Heal/Light custam Mana fixa a menos (real)
  326: 'blessedPlateHealBoost', // Blessed Plate — com 3+ Armadura Pesada, cura em você +35% enquanto abaixo de 35% de vida (real)
  327: 'standby', // Runic Adornments — reduziria dano de magia recebido, mas monstros não têm ataques mágicos nesse jogo — sem efeito possível
  328: 'stubbornWillShieldProc', // Stubborn Will — tomar dano tem chance de dar Escudo Mágico (real)
  329: 'cannonBallThrash', // Cannon Ball — a magia Thrash ganha +10 de dano base fixo (real; Área/Alcance pulados)
  330: 'tauntAoe', // Indecent Gesture — só a parte "Taunt gains +1 Area of Effect" está ativa (+1 alvo extra); o debuff de Movespeed continua sem efeito, sem sistema de Movespeed
  331: 'standby', // Congenital Growth — só teria a parte NEGATIVA implementável (perde Movespeed/AS/Magic) sem a positiva (Range/Pull Force) — injusto implementar só o lado ruim, sem efeito
  332: 'endowedInSteelCount6', // Endowed in Steel — +35 Dano com 6+ Armadura Pesada (real; nosso sistema só tem 4 slots de armadura, então na prática é inalcançável — documentado, não alterei o número real)
  333: 'standby', // Impeccable Set — depende de "Glowing Light", magia não documentada — sem efeito

  // ── Espada / One Hand Combat (ids 340-353) ───────────────────────────────
  340: 'damagePercent', // One Hand Combat — Armas Regulares (espada) têm mais Dano (real)
  341: 'edgeLifeHeal', // Edge Life — abaixo de X% de vida, atacar cura 2 de vida (real)
  342: 'dualSwordPenalty', // Dual-Wielding — duas espadas tamanho 6 reduzem Dano (real; a troca de equipsize não é simulável)
  343: 'theExpertShieldProc', // The Expert — +3 Attackspeed fixo + chance de Escudo Mágico = Ability/10 cap 100 (real)
  344: 'ninjaExtraHit', // To Be Ninja — +3 Attackspeed fixo + chance de golpe extra (homebrew, era boost de Movespeed)
  345: 'bladeManaDiscountFlat', // Fencing Classes — magias Blade custam Mana fixa a menos (real)
  346: 'standby', // Call To Arms — depende de magia não documentada — sem efeito
  347: 'primaDraw', // Prima Draw — cooldown de Blade/Physical -50% + 10% Spellvamp, com 1 arma e sem escudo (real)
  348: 'armorPenFlat', // Resonant Blow — ignora Armor fixa do alvo (real)
  349: 'standby', // Power Contact — depende de "não atacar por 2s", timing que não simulamos — sem efeito
  350: 'standby', // Sacred Accrue — mesmo motivo (timing) — sem efeito
  351: 'echoriadDualWield', // Echoriad — duas espadas: +3 Attackspeed, -35% Dano (real; Range pulado)
  352: 'standby', // Exacted Rectitude — depende do conceito de "ataque empoderado" de Power Contact/Sacred Accrue, que ficaram em standby — sem efeito
  353: 'highlander', // Highlander — magias Blade custam 50% menos mana + Attackspeed vira Dano (real; sem desativar o ataque básico, por segurança)

  // ── Arma Grande / Two Handed Grip (ids 300-313) ──────────────────────────
  300: 'damagePercent', // Two Handed Grip — Armas Grandes têm mais Dano (real)
  301: 'armorPen', // Thorough Puncture — ataques físicos ignoram Armor do alvo (real, agora exclusivo de Arma Grande)
  302: 'bloodbathHeal', // Bloodbath — matar cura % da vida máxima do alvo, cap 50 (real)
  303: 'berserkerScaling', // Berserker — a cada 10% de vida faltando, +1 Dano +1% Lifeleech (real, escala contínua)
  304: 'coreStrength', // Core Strength — ataques gastam 5% da vida máxima em Dano Verdadeiro (cap 20) + 5% Lifeleech (real, arriscado)
  305: 'smiteOnCrit', // Smite — sem "atordoar": crítico causa Dano Verdadeiro extra (homebrew, remapeado de "staggering")
  306: 'gemmedHilt', // Gemmed Hilt — Arma Grande dá +5 Dano Verdadeiro +3 Magic +5 Mana Regen +25 Mana fixos (real)
  307: 'magicBladeLifeMana', // Magic Blade — +10% Manaleech +10% Lifeleech (real; remoção de stats negativos pulada)
  308: 'survivalInstinctFlat', // Survival Instinct — +HP Regen fixo (homebrew, parte de Movespeed pulada)
  309: 'overwhelmingForceChance', // Overwhelming Force — sem área de efeito: chance de dano bônus no golpe (homebrew)
  310: 'preciseTear', // Precise Tear — chance de Dano Verdadeiro = 5% da vida do alvo, cap 50 (real)
  311: 'birthRevelationNoArmor', // Birth Revelation — sem nenhuma armadura equipada, +15 Dano fixo (real; Movespeed pulado)
  312: 'higherRuling', // Higher Ruling — +1 Dano por ponto de Magic final, mas golpe de misericórdia causa Magic×5 em você (real, arriscado)
  313: 'standby', // Unfathomable Rage — mudou de mecânica (agora é "conjurar com Vida"), estrutura complexa demais/arriscada pra retrofit sem quebrar o sistema de magia — sem efeito

  // ── Orbe / Pondering It (ids 360-373) ────────────────────────────────────
  360: 'spellLifesteal', // Pondering It — Spellvamp: cura baseada no dano de magia (real)
  361: 'spellCooldownReduction', // Electric Nature — reduz cooldown de todas as magias (real)
  362: 'diamondSkin', // Diamond Skin — conjurar Energia/Physical/Arrow dá Escudo, empilha até cap 100 (real, ampliado pros 3 tipos)
  363: 'orbShieldProc', // Repelling Shell — tomar dano no Escudo Mágico tem chance de estourar dano verdadeiro homebrew no monstro (real % de chance, efeito "Repelling Force" aproximado)
  364: 'unstableAegis', // Unstable Aegis — mesmo gatilho de Repelling Shell, outro estouro homebrew ("Unstable Berserk")
  365: 'standby', // Magic Collector — bônus depende de "qual outro item você segura", condicional demais pra generalizar — sem efeito
  366: 'standby', // Polymorphic Sphere — "efeito aleatório" sem lista definida — sem efeito
  367: 'standby', // Vessel of Vigor — mesmo motivo — sem efeito
  368: 'healPowerBonus', // Magic Touch — magias de Cura curam mais (real, agora escalando por rank)
  369: 'healManaDiscount25', // Shining Front — magias de Cura custam 25% menos mana (real; "Healing Wind" pulado)
  370: 'holyFlatDamage', // Thorough Judgment — magias Holy +10 de dano base + AoE (agora ativa: 1 alvo extra)
  371: 'standby', // Child's Channel — depende de curar OUTROS jogadores, sem multiplayer — sem efeito
  372: 'onyxScreen', // Onyx Screen — dobra ganho de Escudo Mágico (cap 200), mas dobra o dano normal recebido (real, risco/recompensa)
  373: 'standby', // Inzil's Fate — exige 2 Orbes ao mesmo tempo, mas nosso sistema só permite 1 Orbe (mão secundária) — condição inalcançável, sem efeito
};

// Valores fixos dos nós de 1 ponto só dos 9 ramos revisados nessa leva (Cajado, Adaga,
// Arco, Armadura Leve, Escudo, Arma Grande, Armadura Pesada, Espada, Orbe) — extraídos
// direto do cliente (traits.json), exceto onde marcado "homebrew" (mecânica real depende
// de sistema que esse jogo idle não tem: Movespeed, Range/Distância, Dash/Teleporte,
// stagger, backstab, multiplayer, tipos de munição, timers de "não atacar por X
// segundos"). Nós puramente 1-ponto com valor variável (%chance, stat) já têm a ranks[]
// no RAW_TALENTS acima — as constantes aqui são só pros que NÃO têm valor de rank na
// fonte (ranks: []) mas mesmo assim precisam de um número fixo pra funcionar.

// ── Cajado ──
const CHOSEN_ONE_STAT_BONUS = 15; // Chosen One (real)
const FRIEND_OF_APOGEA_MANA_DISCOUNT_PCT = 35; // real
const FRIEND_OF_APOGEA_DAMAGE_PENALTY_PCT = 25; // real
const WARLOCK_DAMAGE_BONUS_PCT = 25; // real
const WARLOCK_HEAL_PENALTY_PCT = 50; // real
const SHIFT_WARDENS_MAGIC_THRESHOLD = 15; // real
const SHIFT_WARDENS_AS_BONUS = 5; // real
const CONFLAGRATED_MIND_FLAT_DAMAGE = 10; // real

// ── Adaga ──
const FORESEEN_DECAY_TRUE_DAMAGE = 5; // real
const FORESEEN_DECAY_DOUBLE_CHANCE = 0.15; // real
const POISON_SHIV_TRUE_DAMAGE = 5; // real
const DARK_BLADE_MANA_PER_HIT = 3; // real
export const DUAL_DAGGER_DAMAGE_BONUS_PCT = 100; // real ("dobra o Dano")

// ── Arco ──
const BOW_EXPLOSIVE_CHANCE = 0.35; // Explosive Ammo (real)
const BOW_SECONDARY_PROC_CHANCE = 0.35; // Mahogany Build (real)
const BULLSEYE_ABILITY_DIVISOR = 3; // real
const DEFERRED_REVERENCE_MAGIC_DIVISOR = 3; // real
const TUNNELVISION_AS_FLAT = 12; // real

// ── Armadura Leve ──
const BATTLE_BOOTS_CRIT_BONUS = 0.05; // homebrew (era conversão de Movespeed)
const ADVENTURERS_SPIRIT_CAPACITY_DIVISOR = 100; // real
const ADVENTURERS_SPIRIT_STAT_CAP = 10; // real
const SKALSFEET_STAT_BONUS = 3; // homebrew (real não especifica os stats exatos)
const CLOTHES_OF_THE_DAMNED2_MAGIC = 10; // real
const CLOTHES_OF_THE_DAMNED2_SPELLVAMP_PCT = 10; // real
const LIGHT_ARMOR_COUNT_THRESHOLD = 3; // real
const MASQUE_ALL_STATS_BONUS = 1; // real

// ── Escudo ──
const ETCHED_GEMS_SHIELD_GAIN = 20; // real
const ETCHED_GEMS_MANA_SPENT_THRESHOLD_PCT = 50; // real
export const INNERVATED_MANA_DAMAGE_TO_MANA_DIVISOR = 2; // real

// ── Arma Grande ──
const BLOODBATH_HEAL_CAP = 50; // real
const BERSERKER_HEALTH_STEP_PCT = 10; // real: a cada 10% de vida faltando
const BERSERKER_DAMAGE_PER_STEP = 1; // real
const BERSERKER_LIFESTEAL_PER_STEP = 1; // real
const CORE_STRENGTH_HP_SPEND_PCT = 5; // real
const CORE_STRENGTH_TRUE_DAMAGE_CAP = 20; // real
const CORE_STRENGTH_LIFESTEAL_PCT = 5; // real
const MAGIC_BLADE_LIFESTEAL_PCT = 10; // real
export const OVERWHELMING_FORCE_CHANCE = 0.35; // real
const PRECISE_TEAR_CHANCE = 0.35; // real
const PRECISE_TEAR_HEALTH_PCT = 5; // real
const PRECISE_TEAR_CAP = 50; // real
const BIRTH_REVELATION_FLAT_DAMAGE = 15; // real
const HIGHER_RULING_SELF_DAMAGE_MULT = 5; // real

// ── Armadura Pesada ──
const HEAVY_ARMOR_COUNT_ABILITY_PCT = 10; // Juggernaut (real, novo valor)
const HEAVY_ARMOR_COUNT_LIFESTEAL_PCT = 10; // Juggernaut (real)
const LOOMING_DREAD_ARMOR_DIVISOR = 10; // real
const BLESSED_PLATE2_HEAL_BONUS_PCT = 35; // real
const BLESSED_PLATE2_HEALTH_THRESHOLD_PCT = 35; // real
const HEAVY_ARMOR_COUNT_THRESHOLD = 3; // real
const STUBBORN_WILL_SHIELD_GAIN = 20; // homebrew magnitude (fonte real só documenta a % de chance por rank)
const CANNON_BALL_FLAT_DAMAGE = 10; // real
export const ENDOWED_IN_STEEL2_FLAT_DAMAGE = 35; // real
export const ENDOWED_IN_STEEL2_ARMOR_COUNT_MIN = 6; // real — nosso sistema só tem 4 slots de armadura, então isso nunca ativa de verdade (documentado, não alterei o número)

// ── Espada ──
const EDGE_LIFE_HEAL_FLAT = 2; // real
const THE_EXPERT_AS_FLAT = 3; // real
const THE_EXPERT_SHIELD_CHANCE = 0.35; // real
const THE_EXPERT_SHIELD_ABILITY_DIVISOR = 10; // real
const THE_EXPERT_SHIELD_CAP = 100; // real
export const NINJA_EXTRA_HIT_CHANCE = 0.35; // To Be Ninja (real, valor atualizado)
const NINJA_AS_FLAT = 3; // real
const PRIMA_DRAW_CD_REDUCTION_PCT = 50; // real
const PRIMA_DRAW_SPELLVAMP_PCT = 10; // real
const ECHORIAD_AS_FLAT = 3; // real
const ECHORIAD_DAMAGE_PENALTY_PCT = 35; // real
export const HIGHLANDER_MANA_DISCOUNT_PCT = 50; // real
const HIGHLANDER_AS_TO_DAMAGE_DIVISOR = 1; // real: "1 Dano por ponto extra de Attackspeed"

// ── Orbe ──
const DIAMOND_SKIN_SHIELD_CAP = 100; // real (cap total, não é mais "3 stacks" — a fonte antiga tinha isso errado)
const ORB_SHIELD_PROC_CHANCE = 0.5; // real, compartilhado por Repelling Shell e Unstable Aegis
// "Repelling Force" e "Unstable Berserk" não são magias documentadas com fórmula — a
// descrição só diz que são conjuradas, sem valor de dano oficial. Aproximamos os dois
// como estouros de dano verdadeiro (ignora armadura) baseados no Magic, com divisores
// diferentes pra distingui-los.
const REPELLING_SHELL_MAGIC_DIVISOR = 6;
export const UNSTABLE_AEGIS_MAGIC_DIVISOR = 4;
const HEAL_MANA_DISCOUNT_25_PCT = 25; // Shining Front (real)
const HOLY_FLAT_DAMAGE = 10; // Thorough Judgment (real)
const ONYX_SCREEN_SHIELD_CAP = 200; // real

export const DARKNESS_EMBRACE_DEATH_DISCOUNT_PCT = 90; // "10x mais barato" = -90% de custo
export const DARKNESS_EMBRACE_HEAL_SURCHARGE_PCT = 900; // "10x mais caro" = +900% de custo
export const MAGIC_STEEL_SHIELD_CAP = 100; // real (Arcane Trickster, Luva)
const BOTH_HANDS_BONUS = 2; // Power Stance (Luva): "múltiplos bônus de stats" — homebrew, +2 flat em Dano/Armor/Ability
const HAND_FINESSE_AS_CAP = 5; // real (Hand Finesse, Adaga)

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

  // ── Cajado — dados reais do cliente (traits.json) ───────────────────────
  { id: 200, name: 'Staff Mastery', parent: 0, branch: 'staff', description: 'Staves and Wands deal +X True Damage', ranks: ['1', '2', '3', '4', '5'] },
  { id: 201, name: 'Charge the Stick', parent: 200, branch: 'staff', description: 'Casting an Elemental spell with a Staff or Wand empowers your next attack with X% of your spent Mana as True Damage', ranks: ['8%', '12%', '18%'] },
  { id: 202, name: 'Frantic Conjury', parent: 201, branch: 'staff', description: 'Hitting a Fire or Energy spell on a target has a X% chance that your next attack will cast "Conjure Fire" on the target\'s location', ranks: ['20%', '25%', '35%'] },
  { id: 203, name: 'Charged Body', parent: 202, branch: 'staff', description: 'Casting an Energy spell will also cast "Charged Ground". Also, Frantic Conjury will now cast "Conjure Energy"', ranks: [] },
  { id: 204, name: 'Conflagrated Mind', parent: 202, branch: 'staff', description: 'Fire spells have +10 Base Damage and +1 Area of Effect', ranks: [] },
  { id: 205, name: "Gallop's Fall", parent: 201, branch: 'staff', description: 'While holding a Staff or Wand, reduces the cooldown of Earth and Water spells by X%', ranks: ['15%', '20%', '30%'] },
  { id: 206, name: 'Geomancer', parent: 205, branch: 'staff', description: 'While in water, Water spells will also cast "Geyser". While not, Earth spells will also cast "Rock Shield"', ranks: [] },
  { id: 207, name: 'Serene Retribution', parent: 205, branch: 'staff', description: 'Taking Damage from your current target has a 15% chance of casting "Water Wave" towards it', ranks: [] },
  { id: 208, name: 'Wizard Studies', parent: 201, branch: 'staff', description: 'Wands and Staves gain +X Attackspeed', ranks: ['2', '3', '5'] },
  { id: 209, name: 'Chrono Conversion', parent: 208, branch: 'staff', description: 'Gain +15 Magic if you have 5 or more extra Movespeed. Additionally, reduces the cooldown of Time and Mystic spells by 35%', ranks: [] },
  { id: 210, name: 'Shift Wardens', parent: 208, branch: 'staff', description: 'Gain +5 Attackspeed if you have 15 or more extra Magic. Additionally, Dash and Teleporting spells cost 25% less Mana', ranks: [] },
  { id: 211, name: 'Chosen One', parent: 200, branch: 'staff', description: 'Gain +15 Magic and +15 Ability but monsters target you 50% more often', ranks: [] },
  { id: 212, name: 'Friend of Apogea', parent: 200, branch: 'staff', description: 'Earth, Water and Light spells cost 35% less Mana, but spells deal 25% less damage', ranks: [] },
  { id: 213, name: 'Warlock', parent: 200, branch: 'staff', description: 'Spells deal 25% more Damage at the cost of your healing spells being 50% weaker. You also cannot heal other players', ranks: [] },

  // ── Adaga — dados reais do cliente (traits.json) ────────────────────────
  { id: 220, name: 'Stabbing Preference', parent: 0, branch: 'dagger', description: 'Daggers and Knives provide X% Lifeleech', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 221, name: 'Hand Finesse', parent: 220, branch: 'dagger', description: 'Gain +X Attackspeed per 15 Ability you have capping at 5', ranks: ['15', '13', '10'] },
  { id: 222, name: 'Gaff Hack', parent: 221, branch: 'dagger', description: 'Casting a Time or Mystic spell will give your next attack have +X Range and Dash you to your target causing a Backstab', ranks: ['15', '20', '30'] },
  { id: 223, name: 'Slash And Dash', parent: 222, branch: 'dagger', description: 'When you Backstab a target, deal 1.5x Damage and cast "Haste"', ranks: [] },
  { id: 224, name: 'Tendon Cut', parent: 222, branch: 'dagger', description: 'When you Backstab a target, debuff its Movespeed by 15 for 3 seconds and gain 50% Lifeleech on that attack', ranks: [] },
  { id: 225, name: 'Jagged Rhythm', parent: 221, branch: 'dagger', description: 'Attacking using a Dagger or Knife has a X% chance of buffing your Attackspeed by 6 for 4 seconds', ranks: ['7%', '10%', '15%'] },
  { id: 226, name: 'Foreseen Decay', parent: 225, branch: 'dagger', description: 'While using a Dagger or Knife, attacks will deal +5 True Damage and have a 15% chance of happening twice', ranks: [] },
  { id: 227, name: 'Poison Shiv', parent: 225, branch: 'dagger', description: 'While using a Dagger or Knife, attacks will deal +5 True Damage and killing an enemy causes it to explode, damaging nearby foes', ranks: [] },
  { id: 228, name: 'Sweet Spot', parent: 221, branch: 'dagger', description: 'You deal +X Damage if you are closer than 15 Range of your target', ranks: ['3', '5', '8'] },
  { id: 229, name: 'Chunk Sampling', parent: 228, branch: 'dagger', description: 'Staggering an enemy will double your Lifeleech on that attack', ranks: [] },
  { id: 230, name: 'Monster Meat', parent: 228, branch: 'dagger', description: 'Killing a monster buffs and heals allies nearby including you', ranks: [] },
  { id: 231, name: 'Dark Blade', parent: 220, branch: 'dagger', description: 'Doubles all True Damage you deal, but that True Damage also damages you. Attacks also give you +3 Mana', ranks: [] },
  { id: 232, name: 'Double Danger', parent: 220, branch: 'dagger', description: 'Using two Daggers or Knives doubles your extra Damage and Attackspeed, but halves all other extra stats', ranks: [] },
  { id: 233, name: 'Gourmand', parent: 220, branch: 'dagger', description: 'Food gives 6 times the stat buffs, but your Movespeed is capped at 33 and foods no longer give Regen buffs', ranks: [] },

  // ── Arco — dados reais do cliente (traits.json) ─────────────────────────
  { id: 240, name: 'Bow Guidance', parent: 0, branch: 'bow', description: 'Bows and Crossbows have +X Attackspeed', ranks: ['1', '2', '3', '4', '5'] },
  { id: 241, name: 'Good Technique', parent: 240, branch: 'bow', description: 'Attacks deal +X Damage if you are further than 45 Range from the target', ranks: ['2', '3', '6'] },
  { id: 242, name: 'Artisanal Arsenal', parent: 241, branch: 'bow', description: 'Non-magic arrows and bolts have +X Damage and (Ability / 5) chance of being salvaged', ranks: ['5', '4', '2'] },
  { id: 243, name: 'Explosive Ammo', parent: 242, branch: 'bow', description: 'Attacking has a 35% chance of doing a special effect based on your Ammunition type', ranks: [] },
  { id: 244, name: 'Mahogany Build', parent: 242, branch: 'bow', description: 'Attacking has a 35% chance of doing a special effect based on your Distance Weapon type', ranks: [] },
  { id: 245, name: 'Meditation', parent: 241, branch: 'bow', description: 'Time and Mystic spells cost X% less Mana', ranks: ['7%', '13%', '20%'] },
  { id: 246, name: 'Chasing Prey', parent: 245, branch: 'bow', description: "Attacking has a chance equal to your Movespeed to debuff the target's Armor by 10 and Movespeed by 5 for 3 seconds", ranks: [] },
  { id: 247, name: 'Hunt Prep', parent: 245, branch: 'bow', description: 'Casting a Time or Mystic spell will cast "Grand Trap" before it', ranks: [] },
  { id: 248, name: 'Swiftstride', parent: 241, branch: 'bow', description: 'Casting an Arrow spell while using a Bow or Crossbow has a X% chance of casting "Haste"', ranks: ['15%', '22%', '35%'] },
  { id: 249, name: 'Bullseye', parent: 248, branch: 'bow', description: 'Hitting a target with an Arrow or Blade spell will deal +(Ability / 3) as True Damage, doubled if you hit your current target', ranks: [] },
  { id: 250, name: 'Deferred Reverence', parent: 248, branch: 'bow', description: 'Hitting a target with an Arrow or Blade spell will heal you by (Magic / 3), doubled if you hit your current target', ranks: [] },
  { id: 251, name: 'Improvised Sentry', parent: 240, branch: 'bow', description: 'Attacking has a chance equal to your Magic of consuming Ammunition to summon an Improvised Sentry on your location', ranks: [] },
  { id: 252, name: "Mother's Embrace", parent: 240, branch: 'bow', description: 'Arrow spells will be cast twice, but they both deal half the damage', ranks: [] },
  { id: 253, name: 'Tunnelvision', parent: 240, branch: 'bow', description: 'Gain +12 Attackspeed, but you can no longer move while targeting an enemy', ranks: [] },

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

  // ── Armadura Leve — dados reais do cliente (traits.json) ────────────────
  { id: 260, name: 'Cozy and Useful', parent: 0, branch: 'lightarmor', description: 'Light Armor has +X Mana', ranks: ['1', '3', '5', '8', '12'] },
  { id: 261, name: 'Lightfoot', parent: 260, branch: 'lightarmor', description: 'Gain +X Movespeed and +X Max Capacity', ranks: ['20', '30', '50'] },
  { id: 262, name: 'Breeze in Your Hair', parent: 261, branch: 'lightarmor', description: 'Not wearing a helmet gives you +X Movespeed and +X Health Regen', ranks: ['3', '6', '10'] },
  { id: 263, name: 'Battle Boots', parent: 262, branch: 'lightarmor', description: 'Gain 1% chance of dealing 1.5x Damage per 1 Movespeed point', ranks: [] },
  { id: 264, name: "Adventurer's Spirit", parent: 263, branch: 'lightarmor', description: 'Gain +1 Magic and +1 Ability per 100 Max Capacity capping at 10, Backpacks no longer give stats', ranks: [] },
  { id: 265, name: 'Skalsfeet', parent: 262, branch: 'lightarmor', description: 'Not wearing boots gives you multiple stat boosts', ranks: [] },
  { id: 266, name: 'Dressing Wizardly', parent: 261, branch: 'lightarmor', description: 'Light Armor gives you +X Magic and +X Mana Regen', ranks: ['1', '2', '4'] },
  { id: 267, name: 'Clothes of the Damned', parent: 266, branch: 'lightarmor', description: 'Removes Light Armor negative stats. Also, gain +10 Magic and +10% Spellvamp if you have 3 or more equipped Light Armor', ranks: [] },
  { id: 268, name: 'Relic Affinity', parent: 266, branch: 'lightarmor', description: 'Ability and Magic on items now scale with class multipliers. Additionally, Magic and Ability on items each gain 1 extra stat point', ranks: [] },
  { id: 269, name: 'Merc Colors', parent: 261, branch: 'lightarmor', description: 'Light Armor with negative stats have +X Ability', ranks: ['2', '3', '5'] },
  { id: 270, name: 'Quicken Mismatch', parent: 269, branch: 'lightarmor', description: 'Taking damage equal or greater than 15% of your Max Health will cast Surge', ranks: [] },
  { id: 271, name: 'Razor Sprint', parent: 269, branch: 'lightarmor', description: 'Dashing or Teleporting will Damage enemies it passes through. Also gives the spell "Dash" extended range', ranks: [] },
  { id: 272, name: 'Darkness Embrace', parent: 260, branch: 'lightarmor', description: 'Death spells are 10 times cheaper. Heal, Light and Holy spells are 10 times more expensive', ranks: [] },
  { id: 273, name: 'Masque of Elgifu', parent: 260, branch: 'lightarmor', description: "Gain +1 point in all stats, but you're forced to wear a jester outfit", ranks: [] },

  // ── Escudo — dados reais do cliente (traits.json) ───────────────────────
  { id: 280, name: 'Block Efficacy', parent: 0, branch: 'shield', description: 'Shields have X% Defense', ranks: ['1%', '4%', '8%', '13%', '20%'] },
  { id: 281, name: 'Loud Presence', parent: 280, branch: 'shield', description: 'Monsters target you X% more often', ranks: ['25%', '35%', '50%'] },
  { id: 282, name: 'Rooted Guard', parent: 281, branch: 'shield', description: 'Holding a Shield gives you +X Mana Regen', ranks: ['2', '4', '8'] },
  { id: 283, name: 'Elemental Plate', parent: 282, branch: 'shield', description: 'While holding a Shield, casting an Elemental spell will give you a buff based on that element', ranks: [] },
  { id: 284, name: 'Etched Gems', parent: 282, branch: 'shield', description: 'While holding a Shield, spending more than 50% of your Max Mana will give you +20 Magic Shield', ranks: [] },
  { id: 285, name: 'Royal Attire', parent: 281, branch: 'shield', description: 'Reduces the cooldown of Defense and Conjure spells by X%', ranks: ['15%', '20%', '30%'] },
  { id: 286, name: 'Divine Pull', parent: 285, branch: 'shield', description: 'Taunt gains +1 Area of Effect and will also cast "Divine Pull"', ranks: [] },
  { id: 287, name: 'Guard Training', parent: 285, branch: 'shield', description: 'Casting a Defense spell will also cast "Knight\'s Vow"', ranks: [] },
  { id: 288, name: 'Swing Maneuver', parent: 281, branch: 'shield', description: 'Shields have +X Damage', ranks: ['3', '4', '7'] },
  { id: 289, name: 'Bulwark Leap', parent: 288, branch: 'shield', description: 'While holding a Shield, Dashing or Teleporting will damage enemies where you land giving you a Magic Shield based on your Max Capacity', ranks: [] },
  { id: 290, name: 'Shield Throw', parent: 288, branch: 'shield', description: 'Casting a Defense spell will give your next attack +40 Range and cast "Shield Throw" towards your target', ranks: [] },
  { id: 291, name: 'Innervated Mana', parent: 280, branch: 'shield', description: 'Recover 1 Mana per 2 Damage you receive, but casting any spell will empty your Mana pool', ranks: [] },
  { id: 292, name: 'Stricken Devotion', parent: 280, branch: 'shield', description: 'Your Magic Shield decays 50% slower, but natural Shield decay damages you.', ranks: [] },

  // ── Arma Grande / Two Handed Grip — dados reais do cliente (traits.json) ─
  { id: 300, name: 'Two Handed Grip', parent: 0, branch: 'largeweapon', description: 'Large Weapons have X% Damage', ranks: ['1%', '4%', '8%', '13%', '20%'] },
  { id: 301, name: 'Thorough Puncture', parent: 300, branch: 'largeweapon', description: "Physical attacks ignore X% of the target's Armor", ranks: ['12%', '15%', '20%'] },
  { id: 302, name: 'Bloodbath', parent: 301, branch: 'largeweapon', description: 'Killing a unit heals you by X% of their Max Health capping at 50', ranks: ['3%', '5%', '10%'] },
  { id: 303, name: 'Berserker', parent: 302, branch: 'largeweapon', description: 'Gain +1 Damage and +1% Lifeleech for every 10% Health you are missing', ranks: [] },
  { id: 304, name: 'Core Strength', parent: 302, branch: 'largeweapon', description: 'Attacks will spend 5% of your Max Health and convert it into True Damage capping at 20. Also, gain 5% Lifeleech', ranks: [] },
  { id: 305, name: 'Smite', parent: 301, branch: 'largeweapon', description: 'Staggering a unit also deals +X True Damage to it', ranks: ['5', '7', '10'] },
  { id: 306, name: 'Gemmed Hilt', parent: 305, branch: 'largeweapon', description: 'Large Weapons gain +5 True Damage, +3 Magic, +5 Mana Regen and +25 Mana', ranks: [] },
  { id: 307, name: 'Magic Blade', parent: 305, branch: 'largeweapon', description: 'Removes Large Weapons negative stats and gives them +10% Manaleech and +10% Lifeleech', ranks: [] },
  { id: 308, name: 'Survival Instinct', parent: 301, branch: 'largeweapon', description: 'Gain +X Health Regen per 2 extra Movespeed points', ranks: ['1', '2', '4'] },
  { id: 309, name: 'Overwhelming Force', parent: 308, branch: 'largeweapon', description: 'Large Weapons have a 35% chance of casting an area of effect spell around the target', ranks: [] },
  { id: 310, name: 'Precise Tear', parent: 308, branch: 'largeweapon', description: "Large Weapons have a 35% chance of dealing 5% of the target's total health as True Damage capping at 50", ranks: [] },
  { id: 311, name: 'Birth Revelation', parent: 300, branch: 'largeweapon', description: 'Not wearing any armor gives you +15 Damage and +3 Movespeed', ranks: [] },
  { id: 312, name: 'Higher Ruling', parent: 300, branch: 'largeweapon', description: 'Gain +1 Damage per extra Magic point you have, but killing blows damage you for (Magic * 5)', ranks: [] },
  { id: 313, name: 'Unfathomable Rage', parent: 300, branch: 'largeweapon', description: 'All spells are castable using Health, but Heal and Light spells cost twice as much', ranks: [] },

  // ── Armadura Pesada — dados reais do cliente (traits.json) ──────────────
  { id: 320, name: 'Well Protected', parent: 0, branch: 'heavyarmor', description: 'Heavy Armor has +X Health', ranks: ['1', '3', '5', '8', '12'] },
  { id: 321, name: 'Carry your Might', parent: 320, branch: 'heavyarmor', description: 'Heavy Armor has +X Max Capacity and +X Health Regen', ranks: ['1', '2', '4'] },
  { id: 322, name: 'Heavy Metal', parent: 321, branch: 'heavyarmor', description: 'Heavy Armor has +X Ability', ranks: ['1', '2', '3'] },
  { id: 323, name: 'Juggernaut', parent: 322, branch: 'heavyarmor', description: 'Removes Heavy Armor negative stats. Also, gain +10 Ability and +10% Lifeleech if you have 3 or more equipped Heavy Armor', ranks: [] },
  { id: 324, name: 'Looming Dread', parent: 322, branch: 'heavyarmor', description: 'Gain +1 True Damage for every 10 points in Armor', ranks: [] },
  { id: 325, name: 'Royal Marks', parent: 321, branch: 'heavyarmor', description: 'Heal and Light spells cost 2 less Mana', ranks: ['2', '3', '5'] },
  { id: 326, name: 'Blessed Plate', parent: 325, branch: 'heavyarmor', description: "If you have 3 or more equipped Heavy Armor, all spell Healing done to you is 35% stronger while you're under 35% Health", ranks: [] },
  { id: 327, name: 'Runic Adornments', parent: 325, branch: 'heavyarmor', description: "If you have 3 or more equipped Heavy Armor, all spell Damage done to you is 25% weaker while you're above 75% Health", ranks: [] },
  { id: 328, name: 'Stubborn Will', parent: 321, branch: 'heavyarmor', description: 'Taking damage has a X% chance of giving you +X Magic Shield', ranks: ['10%', '15%', '25%'] },
  { id: 329, name: 'Cannon Ball', parent: 328, branch: 'heavyarmor', description: 'Thrash gains +10 Base Damage, +1 Area of Effect and +1 Range', ranks: [] },
  { id: 330, name: 'Indecent Gesture', parent: 328, branch: 'heavyarmor', description: "Taunt gains +1 Area of Effect and will debuff target's Movespeed by 5 for 5 seconds", ranks: [] },
  { id: 331, name: 'Congenital Growth', parent: 320, branch: 'heavyarmor', description: 'Gain +10 Range and attacks have a 35% chance of casting "Pull Force" towards your target, but lose 5 Movespeed, Attackspeed and Magic', ranks: [] },
  { id: 332, name: 'Endowed in Steel', parent: 320, branch: 'heavyarmor', description: 'If you have 6 or more equipped Heavy Armor, gain +35 Damage', ranks: [] },
  { id: 333, name: 'Impeccable Set', parent: 320, branch: 'heavyarmor', description: 'While at full Health and Mana, casting any spell will also cast "Glowing Light"', ranks: [] },

  // ── Espada / One Hand Combat — dados reais do cliente (traits.json) ─────
  { id: 340, name: 'One Hand Combat', parent: 0, branch: 'sword', description: 'Regular Weapons have X% Damage', ranks: ['1%', '4%', '8%', '13%', '20%'] },
  { id: 341, name: 'Edge Life', parent: 340, branch: 'sword', description: "While you're under X% Health, attacking with a Regular Weapon heals you for 2 Health", ranks: ['2%', '3%', '5%'] },
  { id: 342, name: 'Dual-wielding', parent: 341, branch: 'sword', description: 'Size 6 Regular Weapons have an equipsize of 5, but deal X% less Damage', ranks: ['35%', '30%', '25%'] },
  { id: 343, name: 'The Expert', parent: 342, branch: 'sword', description: 'Gain +3 Attackspeed. Your attacks also have a 35% chance of giving you a Magic Shield equal to (Ability / 10) capping at 100', ranks: [] },
  { id: 344, name: 'To Be Ninja', parent: 342, branch: 'sword', description: 'Gain +3 Attackspeed. Your attacks also have a 35% chance of boosting your Movespeed by 10 for 4 seconds', ranks: [] },
  { id: 345, name: 'Fencing Classes', parent: 341, branch: 'sword', description: 'Blade spells cost 5 less Mana', ranks: ['5', '7', '10'] },
  { id: 346, name: 'Call To Arms', parent: 345, branch: 'sword', description: 'While holding one Regular Weapon with no Shield, hitting a target with a Blade or Physical spell will make your next spell also cast "Call To Arms"', ranks: [] },
  { id: 347, name: 'Prima Draw', parent: 345, branch: 'sword', description: 'While holding one Regular Weapon with no Shield, reduces the cooldown of Blade and Physical spells by 50% and gain 10% Spellvamp', ranks: [] },
  { id: 348, name: 'Resonant Blow', parent: 341, branch: 'sword', description: 'Attacking a target with a Regular Weapon ignores 5 flat Armor', ranks: ['5', '7', '10'] },
  { id: 349, name: 'Power Contact', parent: 348, branch: 'sword', description: 'After not attacking for 2 seconds your next attack will make you cast "Heal"', ranks: [] },
  { id: 350, name: 'Sacred Accrue', parent: 348, branch: 'sword', description: 'After not attacking for 2 seconds, Empower your next attack to deal +25 True Damage', ranks: [] },
  { id: 351, name: 'Echoriad', parent: 340, branch: 'sword', description: 'While Dual-Wielding gain +35 Range and +3 Attackspeed, but your Damage is reduced by 35%', ranks: [] },
  { id: 352, name: 'Exacted Rectitude', parent: 340, branch: 'sword', description: 'Empowered attacks will also cast "Light Strike" on the target\'s location, but you can no longer deal killing blows', ranks: [] },
  { id: 353, name: 'Highlander', parent: 340, branch: 'sword', description: 'Blade spells cost 50% less Mana, lose the ability to auto-attack. Also gain +1 Damage per extra Attackspeed point', ranks: [] },

  // ── Orbe / Pondering It — dados reais do cliente (traits.json) ──────────
  { id: 360, name: 'Pondering It', parent: 0, branch: 'orb', description: 'Orbs and Artifacts provide X% Spellvamp', ranks: ['1%', '3%', '6%', '10%', '15%'] },
  { id: 361, name: 'Electric Nature', parent: 360, branch: 'orb', description: 'Reduces the cooldown of spells by X%', ranks: ['7%', '10%', '15%'] },
  { id: 362, name: 'Diamond Skin', parent: 361, branch: 'orb', description: 'Hitting an Energy, Physical or Arrow spell on an enemy will give you 25 shield, capping at 100', ranks: ['25', '35', '50'] },
  { id: 363, name: 'Repelling Shell', parent: 362, branch: 'orb', description: 'Taking Magic Shield damage has a 50% chance of casting "Repelling Force" around yourself', ranks: [] },
  { id: 364, name: 'Unstable Aegis', parent: 362, branch: 'orb', description: 'Taking Magic Shield damage has a 50% chance of casting "Unstable Berserk" around yourself', ranks: [] },
  { id: 365, name: 'Magic Collector', parent: 361, branch: 'orb', description: "Orbs and Artifacts give +X of a stat based on the other item you're holding", ranks: ['2', '3', '6'] },
  { id: 366, name: 'Polymorphic Sphere', parent: 365, branch: 'orb', description: 'While holding an Orb or Artifact, hitting an enemy with a spell has a 50% chance of doing a random effect on it', ranks: [] },
  { id: 367, name: 'Vessel of Vigor', parent: 365, branch: 'orb', description: 'While holding an Orb or Artifact, casting a spell has a 50% chance of having random effect on you', ranks: [] },
  { id: 368, name: 'Magic Touch', parent: 361, branch: 'orb', description: 'Heal spells are X% stronger', ranks: ['15%', '20%', '35%'] },
  { id: 369, name: 'Shining Front', parent: 368, branch: 'orb', description: 'Casting a Heal spell will also cast "Healing Wind". Also, Heal spells cost 25% less Mana', ranks: [] },
  { id: 370, name: 'Thorough Judgment', parent: 368, branch: 'orb', description: 'Holy spells have +10 Base Damage and +1 Area of Effect', ranks: [] },
  { id: 371, name: "Child's Channel", parent: 360, branch: 'orb', description: 'Healing other players is 50% stronger and also heal you. But spells deal 25% less Damage', ranks: [] },
  { id: 372, name: 'Onyx Screen', parent: 360, branch: 'orb', description: 'Doubles all Magic Shield, which now caps at 200, but you take twice as much regular Damage', ranks: [] },
  { id: 373, name: "Inzil's Fate", parent: 360, branch: 'orb', description: 'While holding two Orbs or Artifacts gain +60 Range and +(Magic / 5) True Damage but when attacking you have a 15% chance of casting "Magic Implosion"', ranks: [] },
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
export const EXTRA_REQUIREMENTS = {
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

  // Os outros 9 ramos seguem o mesmo padrão real (extraído direto do cliente via
  // traits.json → campo "requires", autoritativo): nós de tier 4 exigem o pai direto
  // maximizado + a raiz do ramo maximizada; nós de tier 5 (capstones) exigem os 2 nós
  // de tier 4 do mesmo sub-ramo, ambos investidos ao menos 1 ponto.
  203: [[202, 3], [200, 5]],
  204: [[202, 3], [200, 5]],
  206: [[205, 3], [200, 5]],
  207: [[205, 3], [200, 5]],
  209: [[200, 5], [208, 3]],
  210: [[200, 5], [208, 3]],
  211: [[209, 1], [210, 1]],
  212: [[206, 1], [207, 1]],
  213: [[203, 1], [204, 1]],
  223: [[222, 3], [220, 5]],
  224: [[222, 3], [220, 5]],
  226: [[225, 3], [220, 5]],
  227: [[225, 3], [220, 5]],
  229: [[220, 5], [228, 3]],
  230: [[220, 5], [228, 3]],
  231: [[226, 1], [227, 1]],
  232: [[223, 1], [224, 1]],
  233: [[229, 1], [230, 1]],
  243: [[242, 3], [240, 5]],
  244: [[242, 3], [240, 5]],
  246: [[240, 5], [245, 3]],
  247: [[240, 5], [245, 3]],
  249: [[240, 5], [248, 3]],
  250: [[240, 5], [248, 3]],
  251: [[243, 1], [244, 1]],
  252: [[249, 1], [250, 1]],
  253: [[246, 1], [247, 1]],
  263: [[262, 3], [260, 5]],
  264: [[263, 1], [265, 1]],
  265: [[262, 3], [260, 5]],
  267: [[260, 5], [266, 3]],
  268: [[260, 5], [266, 3]],
  270: [[260, 5], [269, 3]],
  271: [[260, 5], [269, 3]],
  272: [[267, 1], [268, 1]],
  273: [[270, 1], [271, 1]],
  283: [[280, 5], [282, 3]],
  284: [[280, 5], [282, 3]],
  286: [[280, 5], [285, 3]],
  287: [[280, 5], [285, 3]],
  289: [[280, 5], [288, 3]],
  290: [[280, 5], [288, 3]],
  291: [[283, 1], [284, 1]],
  292: [[286, 1], [287, 1]],
  303: [[302, 3], [300, 5]],
  304: [[302, 3], [300, 5]],
  306: [[305, 3], [300, 5]],
  307: [[305, 3], [300, 5]],
  309: [[308, 3], [300, 5]],
  310: [[308, 3], [300, 5]],
  311: [[309, 1], [310, 1]],
  312: [[306, 1], [307, 1]],
  313: [[303, 1], [304, 1]],
  323: [[322, 3], [320, 5]],
  324: [[322, 3], [320, 5]],
  326: [[325, 3], [320, 5]],
  327: [[325, 3], [320, 5]],
  329: [[328, 3], [320, 5]],
  330: [[328, 3], [320, 5]],
  331: [[329, 1], [330, 1]],
  332: [[323, 1], [324, 1]],
  333: [[326, 1], [327, 1]],
  343: [[342, 3], [340, 5]],
  344: [[342, 3], [340, 5]],
  346: [[345, 3], [340, 5]],
  347: [[345, 3], [340, 5]],
  349: [[340, 5], [348, 3]],
  350: [[340, 5], [348, 3]],
  351: [[343, 1], [344, 1]],
  352: [[349, 1], [350, 1]],
  353: [[346, 1], [347, 1]],
  363: [[362, 3], [360, 5]],
  364: [[362, 3], [360, 5]],
  366: [[365, 3], [360, 5]],
  367: [[365, 3], [360, 5]],
  369: [[368, 3], [360, 5]],
  370: [[368, 3], [360, 5]],
  371: [[369, 1], [370, 1]],
  372: [[363, 1], [364, 1]],
  373: [[366, 1], [367, 1]],
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
    armorPenFlat: 0,
    critChance: 0,
    critMultiplier: 1.5,
    damagePercent: 0,
    armorPercent: 0,
    trueDamageFlat: 0,
    trueDamageDoubled: false,
    spellCooldownReductionPercent: 0,
    spellLifestealPercent: 0,
    healPowerBonusPercent: 0,
    healManaDiscountPercent: 0,
    magicPercent: 0,
    abilityPercent: 0,

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

    // ── Cajado ──
    staffChargePct: 0,
    franticConjuryChance: 0,
    fireFlatDamage: 0,
    fireAoeActive: false, // Conflagrated Mind: magias Fire acertam +1 alvo extra
    earthWaterCooldownReductionPercent: 0,
    timeCooldownReductionPercent: 0, // Chrono Conversion
    magicThresholdAttackSpeedActive: false,
    chosenOneActive: false,
    friendOfApogeaActive: false,
    warlockNewActive: false,

    // ── Adaga ──
    castAttackBurstChance: 0,
    daggerExtraHitOnAttackChance: 0,
    foreseenDecayActive: false,
    poisonShivFlatTrueDamage: 0,
    sweetSpotFlatDamage: 0,
    darkBladePlusActive: false,
    dualDaggerDamageActive: false,

    // ── Arco ──
    bowFlatDamageFromRank: 0,
    bowExplosiveChance: 0,
    bowSecondaryProcChance: 0,
    arrowExtraHitChance: 0,
    arrowBladeTrueDamageDivisor: 0,
    arrowBladeHealDivisor: 0,
    timeManaDiscountPercent: 0, // Meditation

    // ── Armadura Leve ──
    lightArmorCapacity: 0,
    lightArmorNoHelmetHpRegen: 0,
    adventurersSpiritActive: false,
    skalsfeetActive: false,
    clothesOfTheDamned2Active: false,
    mercColorsAbility: 0,
    masqueActive: false,

    // ── Escudo ──
    shieldManaRegen: 0,
    etchedGemsActive: false,
    defenseConjureCooldownReductionPercent: 0,
    shieldFlatDamage: 0,
    innervatedManaActive: false,

    // ── Armadura Pesada ──
    heavyArmorCapacity: 0,
    heavyArmorHpRegen: 0,
    heavyArmorCountLifeleechActive: false,
    loomingDreadArmorDivisor: 0,
    healLightFlatDiscount: 0,
    blessedPlateHealBoostActive: false,
    stubbornWillChance: 0,
    cannonBallActive: false,
    endowedInSteel2Active: false,

    // ── Espada ──
    edgeLifeThresholdPercent: 0,
    dualSwordPenaltyPercent: 0,
    theExpertActive: false,
    ninjaExtraHitChance: 0,
    bladeManaDiscountFlat: 0,
    primaDrawActive: false,
    echoriadActive: false,
    highlanderActive: false,

    // ── Arma Grande ──
    bloodbathHealPercent: 0,
    berserkerScalingActive: false,
    coreStrengthActive: false,
    smiteOnCritTrueDamage: 0,
    gemmedHiltActive: false,
    magicBladeLifeManaActive: false,
    survivalInstinctHpRegen: 0,
    overwhelmingForceChance: 0,
    preciseTearActive: false,
    birthRevelationActive: false,
    higherRulingActive: false,

    // ── Orbe ──
    diamondSkinValue: 0,
    orbShieldProcActive: false,
    unstableAegisActive: false,
    healManaDiscount25Active: false,
    holyFlatDamage: 0,
    holyAoeActive: false, // Thorough Judgment: magias Holy acertam +1 alvo extra
    onyxScreenActive: false,

    // ── AoE (Escudo/Armadura Pesada: Taunt) ──
    tauntAoeExtraTargets: 0,
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
      case 'trueDamageDouble':
        mods.trueDamageDoubled = true;
        break;
      case 'spellCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.spellCooldownReductionPercent += rankValue;
        break;
      case 'spellLifesteal':
        if (!Number.isNaN(rankValue)) mods.spellLifestealPercent += rankValue;
        break;
      case 'diamondSkin':
        if (!Number.isNaN(rankValue)) mods.diamondSkinValue = rankValue;
        break;
      case 'unstableAegis':
        mods.unstableAegisActive = true;
        break;
      case 'healPowerBonus':
        if (!Number.isNaN(rankValue)) mods.healPowerBonusPercent = rankValue;
        break;
      case 'highlander':
        mods.highlanderActive = true;
        break;
      case 'standby':
        break;

      // ── Cajado ───────────────────────────────────────────────────────────
      case 'staffTrueDamage':
        if (!Number.isNaN(rankValue)) mods.trueDamageFlat += rankValue;
        break;
      case 'staffChargePct':
        if (!Number.isNaN(rankValue)) mods.staffChargePct = rankValue / 100;
        break;
      case 'franticConjury':
        if (!Number.isNaN(rankValue)) mods.franticConjuryChance = rankValue / 100;
        break;
      case 'fireFlatDamage':
        mods.fireFlatDamage += CONFLAGRATED_MIND_FLAT_DAMAGE;
        mods.fireAoeActive = true;
        break;
      case 'earthWaterCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.earthWaterCooldownReductionPercent = rankValue;
        break;
      // Chrono Conversion: só a redução de cooldown de magia Time está ativa (real,
      // 35% fixo — nó de 1 ponto só); o "+15 Magic com 5+ Movespeed extra" continua
      // sem efeito, sem sistema de Movespeed nesse jogo.
      case 'timeCooldownReduction':
        mods.timeCooldownReductionPercent = 35;
        break;
      case 'magicThresholdAttackSpeed':
        mods.magicThresholdAttackSpeedActive = true;
        break;
      case 'chosenOne':
        mods.chosenOneActive = true;
        mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + CHOSEN_ONE_STAT_BONUS;
        mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + CHOSEN_ONE_STAT_BONUS;
        break;
      case 'friendOfApogea':
        mods.friendOfApogeaActive = true;
        mods.damagePercent -= FRIEND_OF_APOGEA_DAMAGE_PENALTY_PCT;
        break;
      case 'warlockNew':
        mods.warlockNewActive = true;
        mods.damagePercent += WARLOCK_DAMAGE_BONUS_PCT;
        break;

      // ── Adaga ────────────────────────────────────────────────────────────
      case 'castAttackBurst':
        if (!Number.isNaN(rankValue)) mods.castAttackBurstChance += rankValue / 100;
        break;
      case 'daggerExtraHitOnAttack':
        if (!Number.isNaN(rankValue)) mods.daggerExtraHitOnAttackChance = rankValue / 100;
        break;
      case 'foreseenDecay':
        mods.foreseenDecayActive = true;
        mods.trueDamageFlat += FORESEEN_DECAY_TRUE_DAMAGE;
        break;
      case 'poisonShiv':
        mods.poisonShivFlatTrueDamage = POISON_SHIV_TRUE_DAMAGE;
        mods.trueDamageFlat += POISON_SHIV_TRUE_DAMAGE;
        break;
      case 'sweetSpotFlatDamage':
        if (!Number.isNaN(rankValue)) mods.sweetSpotFlatDamage = rankValue;
        break;
      case 'darkBladePlus':
        mods.darkBladePlusActive = true;
        mods.trueDamageDoubled = true;
        break;
      case 'dualDaggerDamage':
        if (isDualWieldCategory(equipment, 'dagger')) {
          mods.dualDaggerDamageActive = true;
          mods.damagePercent += DUAL_DAGGER_DAMAGE_BONUS_PCT;
        }
        break;

      // ── Arco ─────────────────────────────────────────────────────────────
      case 'bowFlatDamageRanked':
        if (!Number.isNaN(rankValue)) mods.bowFlatDamageFromRank += rankValue;
        break;
      case 'timeManaDiscount':
        if (!Number.isNaN(rankValue)) mods.timeManaDiscountPercent = rankValue;
        break;
      case 'bowFlatDamage2':
        if (!Number.isNaN(rankValue)) mods.bowFlatDamageFromRank += rankValue;
        break;
      case 'bowExplosiveChance':
        mods.bowExplosiveChance = BOW_EXPLOSIVE_CHANCE;
        break;
      case 'bowSecondaryProcChance':
        mods.bowSecondaryProcChance = BOW_SECONDARY_PROC_CHANCE;
        break;
      case 'arrowExtraHitChance':
        if (!Number.isNaN(rankValue)) mods.arrowExtraHitChance = rankValue / 100;
        break;
      case 'arrowBladeTrueDamage':
        mods.arrowBladeTrueDamageDivisor = BULLSEYE_ABILITY_DIVISOR;
        break;
      case 'arrowBladeHeal':
        mods.arrowBladeHealDivisor = DEFERRED_REVERENCE_MAGIC_DIVISOR;
        break;
      case 'attackSpeedFlat12':
        mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + TUNNELVISION_AS_FLAT;
        break;

      // ── Armadura Leve ────────────────────────────────────────────────────
      case 'lightArmorMana':
        if (!Number.isNaN(rankValue)) mods.statBonuses.mana = (mods.statBonuses.mana ?? 0) + rankValue;
        break;
      case 'lightArmorCapacity':
        if (!Number.isNaN(rankValue)) mods.lightArmorCapacity = rankValue;
        break;
      case 'lightArmorNoHelmetHpRegen':
        if (!Number.isNaN(rankValue) && !equipment?.head) {
          mods.statBonuses.hpRegen = (mods.statBonuses.hpRegen ?? 0) + rankValue;
        }
        break;
      case 'battleBootsCrit':
        mods.critChance += BATTLE_BOOTS_CRIT_BONUS;
        break;
      case 'adventurersSpirit':
        mods.adventurersSpiritActive = true;
        break;
      case 'skalsfeetNoBoots':
        if (!equipment?.boots) {
          mods.skalsfeetActive = true;
          mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + SKALSFEET_STAT_BONUS;
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + SKALSFEET_STAT_BONUS;
        }
        break;
      case 'dressingWizardly2':
        if (!Number.isNaN(rankValue)) {
          mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + rankValue;
          mods.statBonuses.mpRegen = (mods.statBonuses.mpRegen ?? 0) + rankValue;
        }
        break;
      case 'clothesOfTheDamned2':
        if (countArmorPieces(equipment, 'light') >= LIGHT_ARMOR_COUNT_THRESHOLD) {
          mods.clothesOfTheDamned2Active = true;
          mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + CLOTHES_OF_THE_DAMNED2_MAGIC;
          mods.spellLifestealPercent += CLOTHES_OF_THE_DAMNED2_SPELLVAMP_PCT;
        }
        break;
      case 'mercColorsNegativeStat': {
        const hasNegativeLightArmor = ARMOR_SLOTS.some((slot) => {
          const item = equipment?.[slot];
          if (!item?.category?.startsWith('light')) return false;
          return Object.values(item.stats ?? {}).some((v) => v < 0);
        });
        if (!Number.isNaN(rankValue) && hasNegativeLightArmor) {
          mods.mercColorsAbility = rankValue;
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + rankValue;
        }
        break;
      }
      case 'darknessEmbrace':
        mods.darknessEmbraceActive = true;
        break;
      case 'masqueAllStats':
        mods.masqueActive = true;
        for (const stat of ['damage', 'armor', 'magic', 'ability', 'health', 'mana', 'attackSpeed']) {
          mods.statBonuses[stat] = (mods.statBonuses[stat] ?? 0) + MASQUE_ALL_STATS_BONUS;
        }
        break;

      // ── Escudo ───────────────────────────────────────────────────────────
      case 'shieldManaRegen':
        if (!Number.isNaN(rankValue)) mods.shieldManaRegen = rankValue;
        break;
      case 'etchedGemsShield':
        mods.etchedGemsActive = true;
        break;
      case 'defenseConjureCooldownReduction':
        if (!Number.isNaN(rankValue)) mods.defenseConjureCooldownReductionPercent = rankValue;
        break;
      case 'shieldFlatDamage':
        if (!Number.isNaN(rankValue)) mods.shieldFlatDamage = rankValue;
        break;
      case 'innervatedMana':
        mods.innervatedManaActive = true;
        break;

      // ── Armadura Pesada ──────────────────────────────────────────────────
      case 'heavyArmorHealth':
        if (!Number.isNaN(rankValue)) mods.statBonuses.health = (mods.statBonuses.health ?? 0) + rankValue;
        break;
      case 'heavyArmorCapacityRegen':
        if (!Number.isNaN(rankValue)) {
          mods.heavyArmorCapacity = rankValue;
          mods.heavyArmorHpRegen = rankValue;
        }
        break;
      case 'heavyArmorAbility':
        if (!Number.isNaN(rankValue)) mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + rankValue;
        break;
      case 'heavyArmorCountLifeleech':
        if (countArmorPieces(equipment, 'heavy') >= HEAVY_ARMOR_COUNT_THRESHOLD) {
          mods.heavyArmorCountLifeleechActive = true;
          mods.statBonuses.ability = (mods.statBonuses.ability ?? 0) + HEAVY_ARMOR_COUNT_ABILITY_PCT;
          mods.lifestealPercent += HEAVY_ARMOR_COUNT_LIFESTEAL_PCT;
        }
        break;
      case 'loomingDreadTrueDmg':
        mods.loomingDreadArmorDivisor = LOOMING_DREAD_ARMOR_DIVISOR;
        break;
      case 'healLightFlatDiscount':
        if (!Number.isNaN(rankValue)) mods.healLightFlatDiscount = rankValue;
        break;
      case 'blessedPlateHealBoost':
        if (countArmorPieces(equipment, 'heavy') >= HEAVY_ARMOR_COUNT_THRESHOLD) mods.blessedPlateHealBoostActive = true;
        break;
      case 'stubbornWillShieldProc':
        if (!Number.isNaN(rankValue)) mods.stubbornWillChance = rankValue / 100;
        break;
      case 'cannonBallThrash':
        mods.cannonBallActive = true;
        break;
      case 'endowedInSteel2Count6':
        if (countArmorPieces(equipment, 'heavy') >= ENDOWED_IN_STEEL2_ARMOR_COUNT_MIN) {
          mods.endowedInSteel2Active = true;
          mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + ENDOWED_IN_STEEL2_FLAT_DAMAGE;
        }
        break;

      // ── Espada ───────────────────────────────────────────────────────────
      case 'edgeLifeHeal':
        if (!Number.isNaN(rankValue)) mods.edgeLifeThresholdPercent = rankValue;
        break;
      case 'dualSwordPenalty':
        if (!Number.isNaN(rankValue) && isDualWieldCategory(equipment, 'sword')) {
          mods.dualSwordPenaltyPercent = rankValue;
          mods.damagePercent -= rankValue;
        }
        break;
      case 'theExpertShieldProc':
        mods.theExpertActive = true;
        mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + THE_EXPERT_AS_FLAT;
        break;
      case 'ninjaExtraHit':
        mods.ninjaExtraHitChance = NINJA_EXTRA_HIT_CHANCE;
        mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + NINJA_AS_FLAT;
        break;
      case 'bladeManaDiscountFlat':
        if (!Number.isNaN(rankValue)) mods.bladeManaDiscountFlat = rankValue;
        break;
      case 'primaDraw':
        if (equipment?.weapon?.category === 'sword' && !SHIELD_CATEGORIES.includes(equipment?.offhand?.category)) {
          mods.primaDrawActive = true;
        }
        break;
      case 'armorPenFlat':
        if (!Number.isNaN(rankValue)) mods.armorPenFlat += rankValue;
        break;
      case 'echoriadDualWield':
        if (isDualWieldCategory(equipment, 'sword')) {
          mods.echoriadActive = true;
          mods.statBonuses.attackSpeed = (mods.statBonuses.attackSpeed ?? 0) + ECHORIAD_AS_FLAT;
          mods.damagePercent -= ECHORIAD_DAMAGE_PENALTY_PCT;
        }
        break;

      // ── Arma Grande ──────────────────────────────────────────────────────
      case 'bloodbathHeal':
        if (!Number.isNaN(rankValue)) mods.bloodbathHealPercent = rankValue;
        break;
      case 'berserkerScaling':
        mods.berserkerScalingActive = true;
        break;
      case 'coreStrength':
        mods.coreStrengthActive = true;
        mods.lifestealPercent += CORE_STRENGTH_LIFESTEAL_PCT;
        break;
      case 'smiteOnCrit':
        if (!Number.isNaN(rankValue)) mods.smiteOnCritTrueDamage = rankValue;
        break;
      case 'gemmedHilt':
        mods.gemmedHiltActive = true;
        mods.trueDamageFlat += 5;
        mods.statBonuses.magic = (mods.statBonuses.magic ?? 0) + 3;
        mods.statBonuses.mpRegen = (mods.statBonuses.mpRegen ?? 0) + 5;
        mods.statBonuses.mana = (mods.statBonuses.mana ?? 0) + 25;
        break;
      case 'magicBladeLifeMana':
        mods.magicBladeLifeManaActive = true;
        mods.lifestealPercent += MAGIC_BLADE_LIFESTEAL_PCT;
        break;
      case 'survivalInstinctFlat':
        if (!Number.isNaN(rankValue)) mods.survivalInstinctHpRegen = rankValue;
        break;
      case 'overwhelmingForceChance':
        mods.overwhelmingForceChance = OVERWHELMING_FORCE_CHANCE;
        break;
      case 'preciseTear':
        mods.preciseTearActive = true;
        break;
      case 'birthRevelationNoArmor':
        if (ARMOR_SLOTS.every((slot) => !equipment?.[slot])) {
          mods.birthRevelationActive = true;
          mods.statBonuses.damage = (mods.statBonuses.damage ?? 0) + BIRTH_REVELATION_FLAT_DAMAGE;
        }
        break;
      case 'higherRuling':
        mods.higherRulingActive = true;
        break;

      // ── Orbe ─────────────────────────────────────────────────────────────
      case 'orbShieldProc':
        mods.orbShieldProcActive = true;
        break;
      case 'healManaDiscount25':
        mods.healManaDiscount25Active = true;
        break;
      case 'holyFlatDamage':
        mods.holyFlatDamage = HOLY_FLAT_DAMAGE;
        mods.holyAoeActive = true;
        break;
      // Divine Pull (Escudo) + Indecent Gesture (Armadura Pesada): só a parte "Taunt
      // gains +1 Area of Effect" está implementada — somam entre si (ramos diferentes,
      // não são mutuamente exclusivos).
      case 'tauntAoe':
        mods.tauntAoeExtraTargets += 1;
        break;
      case 'onyxScreen':
        mods.onyxScreenActive = true;
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

  for (const [key, val] of Object.entries(mods.statBonuses)) {
    next[key] = Math.round(((next[key] ?? 0) + val) * 100) / 100;
  }
  // Lightfoot/Carry your Might/Adventurer's Spirit/Skalsfeet/Masque dependem de stats
  // já somados acima (Capacity) ou são flags simples — aplicados aqui, antes dos %.
  if (mods.lightArmorCapacity) next.capacity = Math.round((next.capacity + mods.lightArmorCapacity) * 100) / 100;
  if (mods.heavyArmorCapacity) next.capacity = Math.round((next.capacity + mods.heavyArmorCapacity) * 100) / 100;
  if (mods.heavyArmorHpRegen) next.hpRegen = Math.round(((next.hpRegen ?? 0) + mods.heavyArmorHpRegen) * 100) / 100;
  if (mods.survivalInstinctHpRegen) next.hpRegen = Math.round(((next.hpRegen ?? 0) + mods.survivalInstinctHpRegen) * 100) / 100;
  if (mods.shieldManaRegen) next.mpRegen = Math.round(((next.mpRegen ?? 0) + mods.shieldManaRegen) * 100) / 100;
  // Adventurer's Spirit (Armadura Leve): +1 Magic +1 Ability por 100 de Capacidade
  // Máxima final, cap 10 cada — precisa da Capacity já somada, por isso é aqui.
  if (mods.adventurersSpiritActive) {
    const bonus = Math.min(ADVENTURERS_SPIRIT_STAT_CAP, Math.floor(next.capacity / ADVENTURERS_SPIRIT_CAPACITY_DIVISOR));
    next.magic = Math.round((next.magic + bonus) * 100) / 100;
    next.ability = Math.round((next.ability + bonus) * 100) / 100;
  }
  if (mods.bowFlatDamageFromRank) next.damage = Math.round((next.damage + mods.bowFlatDamageFromRank) * 100) / 100;
  if (mods.sweetSpotFlatDamage) next.damage = Math.round((next.damage + mods.sweetSpotFlatDamage) * 100) / 100;

  if (mods.damagePercent) next.damage = Math.round(next.damage * (1 + mods.damagePercent / 100) * 100) / 100;
  if (mods.armorPercent) next.armor = Math.round(next.armor * (1 + mods.armorPercent / 100) * 100) / 100;
  if (mods.magicPercent) next.magic = Math.round(next.magic * (1 + mods.magicPercent / 100) * 100) / 100;
  if (mods.abilityPercent) next.ability = Math.round(next.ability * (1 + mods.abilityPercent / 100) * 100) / 100;

  next.lifestealPercent = mods.lifestealPercent;
  next.armorPenPercent = mods.armorPenPercent;
  next.armorPenFlat = mods.armorPenFlat;
  next.critChance = mods.critChance;
  next.critMultiplier = mods.critMultiplier;
  next.trueDamageFlat = mods.trueDamageFlat;
  next.trueDamageDoubled = mods.trueDamageDoubled;
  next.spellCooldownReductionPercent = mods.spellCooldownReductionPercent;
  next.spellLifestealPercent = mods.spellLifestealPercent;
  next.healPowerBonusPercent = mods.healPowerBonusPercent;
  next.healManaDiscountPercent = mods.healManaDiscountPercent;
  next.diamondSkinValue = mods.diamondSkinValue;
  next.unstableAegisActive = mods.unstableAegisActive;
  next.highlanderActive = mods.highlanderActive;
  if (mods.highlanderActive) {
    next.damage = Math.round((next.damage + Math.floor(next.attackSpeed / HIGHLANDER_AS_TO_DAMAGE_DIVISOR)) * 100) / 100;
  }

  // ── Cajado ───────────────────────────────────────────────────────────────
  next.staffChargePct = mods.staffChargePct;
  next.franticConjuryChance = mods.franticConjuryChance;
  next.fireFlatDamage = mods.fireFlatDamage;
  next.fireAoeActive = mods.fireAoeActive;
  next.earthWaterCooldownReductionPercent = mods.earthWaterCooldownReductionPercent;
  next.timeCooldownReductionPercent = mods.timeCooldownReductionPercent;
  // Shift Wardens: +5 Attackspeed se Magic final >= 15 (aproximação: usamos o Magic
  // FINAL, já com todos os bônus, em vez de só o "extra" — não dá pra isolar quanto do
  // Magic veio de item/talento vs. base).
  if (mods.magicThresholdAttackSpeedActive && next.magic >= SHIFT_WARDENS_MAGIC_THRESHOLD) {
    next.attackSpeed = Math.round((next.attackSpeed + SHIFT_WARDENS_AS_BONUS) * 100) / 100;
  }
  next.friendOfApogeaActive = mods.friendOfApogeaActive;
  next.warlockNewActive = mods.warlockNewActive;
  if (mods.warlockNewActive) next.healPowerBonusPercent -= WARLOCK_HEAL_PENALTY_PCT;

  // ── Adaga ────────────────────────────────────────────────────────────────
  next.castAttackBurstChance = mods.castAttackBurstChance;
  next.daggerExtraHitOnAttackChance = mods.daggerExtraHitOnAttackChance;
  next.foreseenDecayActive = mods.foreseenDecayActive;
  next.darkBladePlusActive = mods.darkBladePlusActive;
  next.dualDaggerDamageActive = mods.dualDaggerDamageActive;

  // ── Arco ─────────────────────────────────────────────────────────────────
  next.bowExplosiveChance = mods.bowExplosiveChance;
  next.bowSecondaryProcChance = mods.bowSecondaryProcChance;
  next.arrowExtraHitChance = mods.arrowExtraHitChance;
  next.timeManaDiscountPercent = mods.timeManaDiscountPercent;
  // Bullseye/Deferred Reverence: dependem do Ability/Magic FINAL. Como só existe 1 alvo
  // nesse jogo (o "alvo atual" sempre é o único), a condição "dobrado se for o alvo
  // atual" da fonte real vale SEMPRE aqui — por isso já aplicamos o fator 2.
  next.arrowBladeTrueDamage = mods.arrowBladeTrueDamageDivisor ? 2 * (next.ability / mods.arrowBladeTrueDamageDivisor) : 0;
  next.arrowBladeHeal = mods.arrowBladeHealDivisor ? 2 * (next.magic / mods.arrowBladeHealDivisor) : 0;

  // ── Luva ─────────────────────────────────────────────────────────────────
  next.gloveManaOnHitChance = mods.gloveManaOnHitChance;
  next.globalManaDiscountPercent = mods.globalManaDiscountPercent;
  next.gloveNextAttackTrueDamage = mods.gloveNextAttackTrueDamage;
  next.arcaneTricksterShieldGain = mods.arcaneTricksterShieldActive ? Math.min(MAGIC_STEEL_SHIELD_CAP, next.mana / 10) : 0;
  next.seerApparelActive = mods.seerApparelActive;
  next.gloveBattleMageDamage = mods.gloveBattleMageActive
    ? Math.min(next.magic / 3, next.damage / 5 + next.defense)
    : 0;
  next.drunkStyleActive = mods.drunkStyleActive;
  next.supernaturalGambleActive = mods.supernaturalGambleActive;
  next.shapeOfWaterActive = mods.shapeOfWaterActive;
  next.oneWithApogeaGloveActive = mods.oneWithApogeaGloveActive;

  // ── Armadura Leve ────────────────────────────────────────────────────────
  next.darknessEmbraceActive = mods.darknessEmbraceActive;

  // ── Escudo ───────────────────────────────────────────────────────────────
  next.hasShieldEquipped = hasShieldEquipped(equipment);
  next.blockChance = next.hasShieldEquipped ? SHIELD_BASE_BLOCK_CHANCE : 0;
  next.etchedGemsActive = mods.etchedGemsActive;
  next.defenseConjureCooldownReductionPercent = mods.defenseConjureCooldownReductionPercent;
  if (mods.shieldFlatDamage) next.damage = Math.round((next.damage + mods.shieldFlatDamage) * 100) / 100;
  next.innervatedManaActive = mods.innervatedManaActive;

  // ── Armadura Pesada ──────────────────────────────────────────────────────
  next.loomingDreadArmorDivisor = mods.loomingDreadArmorDivisor;
  next.healLightFlatDiscount = mods.healLightFlatDiscount;
  next.blessedPlateHealBoostActive = mods.blessedPlateHealBoostActive;
  next.stubbornWillChance = mods.stubbornWillChance;
  next.cannonBallActive = mods.cannonBallActive;

  // ── Espada ───────────────────────────────────────────────────────────────
  next.edgeLifeThresholdPercent = mods.edgeLifeThresholdPercent;
  next.theExpertActive = mods.theExpertActive;
  next.ninjaExtraHitChance = mods.ninjaExtraHitChance;
  next.bladeManaDiscountFlat = mods.bladeManaDiscountFlat;
  next.primaDrawActive = mods.primaDrawActive;

  // ── Arma Grande ──────────────────────────────────────────────────────────
  next.bloodbathHealPercent = mods.bloodbathHealPercent;
  next.berserkerScalingActive = mods.berserkerScalingActive;
  next.coreStrengthActive = mods.coreStrengthActive;
  next.smiteOnCritTrueDamage = mods.smiteOnCritTrueDamage;
  next.magicBladeLifeManaActive = mods.magicBladeLifeManaActive;
  next.overwhelmingForceChance = mods.overwhelmingForceChance;
  next.preciseTearActive = mods.preciseTearActive;
  next.higherRulingActive = mods.higherRulingActive;

  // ── Orbe ─────────────────────────────────────────────────────────────────
  next.orbShieldProcActive = mods.orbShieldProcActive;
  next.healManaDiscount25Active = mods.healManaDiscount25Active;
  if (next.healManaDiscount25Active) next.healManaDiscountPercent += HEAL_MANA_DISCOUNT_25_PCT;
  next.holyFlatDamage = mods.holyFlatDamage;
  next.holyAoeActive = mods.holyAoeActive;
  next.onyxScreenActive = mods.onyxScreenActive;

  // ── AoE (Taunt) ──────────────────────────────────────────────────────────
  next.tauntAoeExtraTargets = mods.tauntAoeExtraTargets;

  return next;
}
