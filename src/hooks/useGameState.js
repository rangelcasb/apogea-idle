import { useReducer, useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  ZONES,
  STARTER_ITEMS,
  ITEM_TYPES,
  EQUIP_SLOTS,
  HAND_CAPACITY,
  POINTS_PER_LEVEL,
  BOOSTED_MULTIPLIER,
  xpForNextLevel,
  rollLoot,
  computeFinalStats,
  canAllocatePoint,
  allocatePoint,
  unspentPoints,
  getDailyBoostedMonster,
  FOOD_CATEGORIES,
  eatFood,
  tickSatiety,
  QUESTS_BY_ID,
  isQuestComplete,
  isQuestClaimed,
  getShopItemDefinition,
  resolveRealItemName,
  slugify,
  MERCHANTS_BY_NAME,
  computeDamageRoll,
  VOCATION_COST,
  monsterDamageMultiplier,
  rarityAtLeast,
  RARITY_LABELS,
  SPELLS_BY_ID,
  SPELL_SLOTS,
  DEFAULT_HEAL_THRESHOLD_PCT,
  computeSpellEffect,
  canCastSpell,
} from '../data/gameData';
import {
  talentPointsForLevel,
  spentTalentPoints,
  canInvestTalent,
  UNSTABLE_AEGIS_MAGIC_DIVISOR,
  MAGIC_STEEL_SHIELD_CAP,
  HIGHLANDER_MANA_DISCOUNT_PCT,
  DARKNESS_EMBRACE_DEATH_DISCOUNT_PCT,
  DARKNESS_EMBRACE_HEAL_SURCHARGE_PCT,
  INNERVATED_MANA_DAMAGE_TO_MANA_DIVISOR,
  DRUNK_STYLE_FIRE_BREATH_CHANCE,
  SEER_APPAREL_TRUE_DAMAGE,
  SHAPE_OF_WATER_MANA_COST,
  SHAPE_OF_WATER_TRUE_DAMAGE,
  SUPERNATURAL_GAMBLE_MANA_DISCOUNT_PCT,
  SUPERNATURAL_GAMBLE_SELF_DAMAGE_CHANCE,
  ONE_WITH_APOGEA_GLOVE_MANA_DIVISOR,
} from '../data/talents';
import {
  onAuthChange,
  loginWithGoogle,
  logout,
  saveGameState,
  loadGameState,
  createListing,
  loadListings,
  buyListing as buyListingFirestore,
  claimSellerPayout,
  cancelListing as cancelListingFirestore,
} from '../services/firebase';

const SYNC_DEBOUNCE_MS = 1500;

const TURN_MS = 2000;
// Fórmula real: "Regeneration triggers every 10 seconds, restoring half of your HP
// Regen and MP Regen stats each time."
const REGEN_TICK_MS = 10000;
const STORAGE_KEY = 'apogea-idle-character';
// Custo de mana do ataque básico com cajado — não documentado num valor exato pela
// fonte real, só confirmado que existe (daí o talento "Staff Mastery": chance de
// atirar sem esse custo). Fixo e moderado, pra não esvaziar a mana rápido demais.
const STAFF_BASIC_ATTACK_MANA_COST = 3;
// Balanceamento nosso: Magic vira multiplicador da cura das magias de Cura (a cada
// 100 de Magic, dobra) — não é uma fórmula real do jogo.
const HEAL_MAGIC_MULTIPLIER_DIVISOR = 100;

// Constantes REAIS espelhadas de src/data/talents.js — não são exportadas de lá (são
// consts internas do módulo, só os valores "% por rank" que dependem de investimento
// em pontos são exportados), então duplicamos aqui os valores fixos que o reducer
// precisa pra aplicar as mecânicas (ver comentários equivalentes em talents.js).
const FORESEEN_DECAY_DOUBLE_CHANCE = 0.15; // Adaga: Foreseen Decay
const DARK_BLADE_MANA_PER_HIT = 3; // Adaga: Dark Blade Plus
const BOW_ELEMENTAL_EXTRA_PROC_MAGNITUDE = 0.5; // homebrew, mesma magnitude do Explosive Ammo já existente
const CORE_STRENGTH_HP_SPEND_PCT = 5; // Arma Grande: Core Strength
const CORE_STRENGTH_TRUE_DAMAGE_CAP = 20; // Arma Grande: Core Strength
const BLOODBATH_HEAL_CAP = 50; // Arma Grande: Bloodbath
const PRECISE_TEAR_CHANCE = 0.35; // Arma Grande: Precise Tear
const PRECISE_TEAR_HEALTH_PCT = 5; // Arma Grande: Precise Tear
const PRECISE_TEAR_CAP = 50; // Arma Grande: Precise Tear
const HIGHER_RULING_SELF_DAMAGE_MULT = 5; // Arma Grande: Higher Ruling
const MAGIC_BLADE_MANALEECH_PCT = 10; // Arma Grande: Magic Blade
const EDGE_LIFE_HEAL_FLAT = 2; // Espada: Edge Life
const THE_EXPERT_SHIELD_CHANCE = 0.35; // Espada: The Expert
const THE_EXPERT_SHIELD_ABILITY_DIVISOR = 10; // Espada: The Expert
const THE_EXPERT_SHIELD_CAP = 100; // Espada: The Expert (cap do valor ganho por proc)
const PRIMA_DRAW_CD_REDUCTION_PCT = 50; // Espada: Prima Draw
const PRIMA_DRAW_SPELLVAMP_PCT = 10; // Espada: Prima Draw
const STUBBORN_WILL_SHIELD_GAIN = 20; // Armadura Pesada: Stubborn Will
const CANNON_BALL_FLAT_DAMAGE = 10; // Armadura Pesada: Cannon Ball (afeta a magia Thrash)
const BLESSED_PLATE2_HEAL_BONUS_PCT = 35; // Armadura Pesada: Blessed Plate
const BLESSED_PLATE2_HEALTH_THRESHOLD_PCT = 35; // Armadura Pesada: Blessed Plate
const ETCHED_GEMS_SHIELD_GAIN = 20; // Escudo: Etched Gems
const ETCHED_GEMS_MANA_SPENT_THRESHOLD_PCT = 50; // Escudo: Etched Gems
const FRIEND_OF_APOGEA_MANA_DISCOUNT_PCT = 35; // Cajado: Friend of Apogea
const DIAMOND_SKIN_SHIELD_CAP = 100; // Orbe: Diamond Skin (cap total, não mais "3 stacks")
const ORB_SHIELD_PROC_CHANCE = 0.5; // Orbe: Repelling Shell (compartilhado com Unstable Aegis)
const REPELLING_SHELL_MAGIC_DIVISOR = 6; // Orbe: Repelling Shell (divisor DIFERENTE do Unstable Aegis)
const ONYX_SCREEN_SHIELD_CAP = 200; // Orbe: Onyx Screen
// Cap "normal" (sem Onyx Screen) pra ganhos de Escudo Mágico que não têm cap próprio
// documentado (Etched Gems, Stubborn Will, The Expert) — Onyx Screen dobra o ganho E
// substitui esse teto pelo teto maior (ONYX_SCREEN_SHIELD_CAP).
const DEFAULT_SHIELD_GAIN_CAP = 100;
// "Elemental" pro talento Charge the Stick (Cajado): Fire/Energy/Earth/Water/Light/Holy
// — os 6 tipos de magia com afinidade elemental do jogo, excluindo Physical/Death/
// Blade/Conjure/Heal/Defense/Arrow (que não são "elementais").
const STAFF_ELEMENTAL_SPELL_TYPES = ['Fire', 'Energy', 'Earth', 'Water', 'Light', 'Holy'];

// Ganha Escudo Mágico respeitando o cap normal ou (se Onyx Screen estiver ativo) o
// cap maior com o ganho dobrado — reaproveitado por toda mecânica que dá Escudo (Etched
// Gems, Stubborn Will, The Expert; Diamond Skin tem seu próprio cap tratado à parte).
function addShieldGain(currentShield, amount, onyxScreenActive) {
  const gained = onyxScreenActive ? amount * 2 : amount;
  const cap = onyxScreenActive ? ONYX_SCREEN_SHIELD_CAP : DEFAULT_SHIELD_GAIN_CAP;
  return Math.min(cap, (currentShield ?? 0) + gained);
}

// Golpe de ataque básico "avulso", disparado por uma mecânica que não é o ataque
// normal do jogador (ex: Swiftstride — cast de magia Arrow tem chance de disparar um
// golpe extra imediato). Mais simples que o rollHit() de PLAYER_ATTACK (que tem acesso
// a bônus específicos de Arma Grande/Espada que não fazem sentido nesse gatilho), mas
// usa a mesma fórmula real de mitigação de Armor e o mesmo Dano Verdadeiro fixo.
function computeExtraBasicHitDamage(charStats, monster, monsterKillsCount) {
  const isCrit = Math.random() < (charStats.critChance ?? 0);
  const { min: minDamage, max: maxDamage } = computeDamageRoll(charStats);
  let dmg = minDamage + Math.random() * (maxDamage - minDamage);
  if (isCrit) dmg *= charStats.critMultiplier ?? 1;
  dmg *= monsterDamageMultiplier(monsterKillsCount ?? 0);
  const armorAfterFlat = Math.max(0, monster.armor - (charStats.armorPenFlat ?? 0));
  const effectiveArmor = Math.max(0, armorAfterFlat * (1 - (charStats.armorPenPercent ?? 0) / 100));
  const damage = charStats.oneWithApogeaGloveActive
    ? 0
    : Math.max(1, (dmg - effectiveArmor / 2) / (1 + effectiveArmor / 100));
  let trueDamage = charStats.trueDamageFlat ?? 0;
  if (charStats.foreseenDecayActive && trueDamage > 0 && Math.random() < FORESEEN_DECAY_DOUBLE_CHANCE) trueDamage *= 2;
  if (charStats.trueDamageDoubled) trueDamage *= 2;
  return damage + trueDamage;
}

const RESPEC_COST = 200;
const TALENT_RESET_BASE_COST = 200;
// Progresso offline: no máximo 8h de recompensa, e só XP/gold (nada de item — não
// tem como saber que peso "teria" cabido na mochila do jeito que o real drop escolhe).
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const OFFLINE_MIN_MS = 60 * 1000; // ignora hiatos triviais (ex: dar refresh na página)

// Custo dobra a cada reset de talentos (200, 400, 800, 1600...) — não é um valor real
// do jogo (o jogo real não deixa resetar talentos livremente), é uma mecânica nossa
// pra desencorajar respec repetido sem travar de vez.
function talentResetCost(resetCount) {
  return TALENT_RESET_BASE_COST * 2 ** (resetCount ?? 0);
}

// Aplica ganho de XP e resolve level-ups (compartilhado entre matar monstro e
// reivindicar recompensa de quest). Retorna os campos atualizados + log com as
// mensagens de level-up já anexadas.
function applyXpGain(char, xpGain, log) {
  let xp = char.xp + xpGain;
  let level = char.level;
  let levelBatches = char.levelBatches;
  let needed = xpForNextLevel(level);
  let nextLog = log;
  let didLevelUp = false;
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    didLevelUp = true;
    levelBatches = [...levelBatches, { remaining: POINTS_PER_LEVEL, spent: {} }];
    nextLog = pushLog(nextLog, `Level up! Agora você é nível ${level}. +${POINTS_PER_LEVEL} pontos de atributo.`);
    needed = xpForNextLevel(level);
  }
  return { xp, level, levelBatches, log: nextLog, leveledUp: didLevelUp };
}

function inventoryWeight(inventory) {
  return inventory.reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0);
}

// Peso é um limite real (a tela mostra "MOCHILA — peso/capacidade OZ"): se pegar um
// item estourasse a capacidade, o item fica pra trás em vez de entrar na mochila.
function mergeLoot(inventory, droppedItems, capacity) {
  const next = [...inventory];
  let weight = inventoryWeight(next);
  const rejected = [];

  for (const drop of droppedItems) {
    const addedWeight = (drop.weight ?? 1) * drop.quantity;
    if (weight + addedWeight > capacity) {
      rejected.push(drop);
      continue;
    }
    const idx = next.findIndex((i) => i.id === drop.id);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + drop.quantity };
    } else {
      next.push({ ...drop });
    }
    weight += addedWeight;
  }
  return { inventory: next, rejected };
}

// Comer automático (opção "Comer automático" do painel Personagem): come TODA comida
// de saciedade (RawFood/EdibleFood/CookedFood/SpecialFood/Drinks) que estiver na
// mochila assim que ela chega — seja de loot ou de compra no mercador. Come a pilha
// inteira de uma vez (a duração de cada unidade soma, igual comer manualmente várias
// vezes seguidas).
function autoEatAllFood(inventory, satiety, log) {
  let nextInventory = inventory;
  let nextSatiety = satiety;
  let nextLog = log;

  for (const item of inventory) {
    if (!FOOD_CATEGORIES.has(item.category) || item.quantity <= 0) continue;
    for (let i = 0; i < item.quantity; i++) {
      nextSatiety = eatFood(nextSatiety, item.category);
    }
    nextSatiety.foodName = nextSatiety.foodName ?? item.name;
    nextInventory = nextInventory.filter((it) => it.id !== item.id);
    nextLog = pushLog(
      nextLog,
      `Você comeu ${item.name} x${item.quantity} automaticamente. Saciado por ${Math.round(nextSatiety.remainingMs / 60000)}min.`,
    );
  }

  return { inventory: nextInventory, satiety: nextSatiety, log: nextLog };
}

function emptyEquipment() {
  return Object.fromEntries(Object.keys(EQUIP_SLOTS).map((slot) => [slot, null]));
}

// Todo personagem começa como Squire — sem vocação, todos os multiplicadores
// neutros. Só depois de pagar VOCATION_COST em gold é que escolhe Knight/Rogue/Mage
// (escolha permanente, real do jogo).
function createCharacter(name) {
  const raw = {
    name: name?.trim() || 'Aventureiro',
    class: 'Squire',
    level: 1,
    xp: 0,
    gold: 0,
    kills: 0,
    deaths: 0,
    zoneKills: {},
    totalGoldEarned: 0,
    totalXpEarned: 0,
    levelBatches: [],
    talentPoints: {},
    equipment: emptyEquipment(),
    inventory: STARTER_ITEMS.map((i) => ({ ...i })),
    bank: [],
    monsterKills: {},
    itemBlacklist: [],
    talentResetCount: 0,
    currentHealth: 0,
    currentMana: 0,
    zoneId: ZONES[0].id,
    satiety: { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: [],
    autoCombat: false,
    autoEat: false,
    learnedSpells: [],
    equippedSpells: Array(SPELL_SLOTS).fill(null),
    autoCastSpells: false,
    autoPotion: { enabled: false, healthPct: 30, manaPct: 30 },
    spellHealThresholds: {},
    staffChargeBuff: 0,
    franticConjuryBuff: false,
    shieldPoints: 0,
    castAttackBurstBuff: false,
    castBlockBuff: false,
    blockEmpowerBuff: false,
    updatedAt: Date.now(),
  };
  const stats = computeFinalStats(raw);
  raw.currentHealth = stats.health;
  raw.currentMana = stats.mana;
  return raw;
}

// Bug real corrigido: itens de loot com nome "antigo" (ex: "Evil Book Dark Bind", da
// tabela de drops) nasciam com esse nome cru em vez do nome canônico do catálogo
// ("Evil Spellbook: DarkBind") — os stats vinham certos (o resolvedor já existia pra
// isso), só o NOME ficava errado, quebrando tudo que compara por nome exato (aprender
// magia, ícone). Personagens que já tinham itens assim salvos precisam ser migrados
// aqui; loot novo já nasce certo (ver rollLoot em lootItems.js).
function migrateItemNames(items) {
  return (items ?? []).map((item) => {
    const resolvedName = resolveRealItemName(item.name);
    if (resolvedName === item.name) return item;
    return { ...item, name: resolvedName, id: `${slugify(resolvedName)}-${item.rarity}` };
  });
}

// Personagens salvos antes do sistema de pontos/equipamento/talentos não têm esses
// campos — preenchemos com valores neutros pra não quebrar a tela ao carregar um save
// antigo.
function migrateCharacter(char) {
  if (!char) return char;
  return {
    ...char,
    name: char.name ?? 'Aventureiro',
    kills: char.kills ?? 0,
    deaths: char.deaths ?? 0,
    zoneKills: char.zoneKills ?? {},
    totalGoldEarned: char.totalGoldEarned ?? char.gold ?? 0,
    totalXpEarned: char.totalXpEarned ?? char.xp ?? 0,
    levelBatches: char.levelBatches ?? [],
    talentPoints: char.talentPoints ?? {},
    equipment: char.equipment ?? emptyEquipment(),
    currentMana: char.currentMana ?? 0,
    satiety: char.satiety ?? { remainingMs: 0, bonus: null, foodName: null },
    claimedQuests: char.claimedQuests ?? [],
    inventory: migrateItemNames(char.inventory),
    bank: migrateItemNames(char.bank),
    monsterKills: char.monsterKills ?? {},
    // Formato antigo era um array de strings (nome do item, sempre bloqueado em
    // qualquer raridade) — convertido pro formato novo { name, minRarity }.
    itemBlacklist: (char.itemBlacklist ?? []).map((entry) =>
      typeof entry === 'string' ? { name: entry, minRarity: null } : entry,
    ),
    autoCombat: char.autoCombat ?? false,
    autoEat: char.autoEat ?? false,
    talentResetCount: char.talentResetCount ?? 0,
    learnedSpells: char.learnedSpells ?? [],
    equippedSpells: char.equippedSpells ?? Array(SPELL_SLOTS).fill(null),
    autoCastSpells: char.autoCastSpells ?? false,
    autoPotion: char.autoPotion ?? { enabled: false, healthPct: 30, manaPct: 30 },
    spellHealThresholds: char.spellHealThresholds ?? {},
    staffChargeBuff: char.staffChargeBuff ?? 0,
    franticConjuryBuff: char.franticConjuryBuff ?? false,
    shieldPoints: char.shieldPoints ?? 0,
    castAttackBurstBuff: char.castAttackBurstBuff ?? false,
    castBlockBuff: char.castBlockBuff ?? false,
    blockEmpowerBuff: char.blockEmpowerBuff ?? false,
    updatedAt: char.updatedAt ?? 0,
  };
}

function pickMonster(zoneId) {
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const template = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  return { ...template, currentHealth: template.health, maxHealth: template.health };
}

function pushLog(log, message) {
  return [{ message, id: Date.now() + Math.random() }, ...log].slice(0, 50);
}

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const character = saved ? migrateCharacter(JSON.parse(saved)) : null;
  return {
    character,
    monster: character ? pickMonster(character.zoneId) : null,
    log: [],
    // Retoma o combate automático de onde parou — se estava caçando quando a aba
    // fechou (e não morreu), continua caçando ao reabrir.
    autoCombat: character?.autoCombat && character.currentHealth > 0,
    combatPauseUntil: 0,
    spellCooldowns: {},
  };
}

// Acha a maior poção disponível na mochila pra um stat (health/mana) — usar a maior
// primeiro é mais eficiente pro auto-uso (menos vezes que precisa checar de novo).
function findBestPotion(inventory, statKey) {
  let best = null;
  let bestIdx = -1;
  inventory.forEach((item, idx) => {
    if (item.category === 'Potions' && item.stats?.[statKey] > 0 && item.quantity > 0) {
      if (!best || item.stats[statKey] > best.stats[statKey]) {
        best = item;
        bestIdx = idx;
      }
    }
  });
  return bestIdx >= 0 ? { item: best, idx: bestIdx } : null;
}

// Poção automática: se a vida ou a mana caírem pra igual ou abaixo da % configurada
// pelo jogador, usa a maior poção disponível daquele tipo — igual clicar "USAR" na
// mochila, só que sozinho. Checado depois de qualquer coisa que reduza vida/mana
// (ataque do monstro, gasto de mana em magia) e também no tick de regeneração como
// rede de segurança.
function autoUsePotions(char, stats, log) {
  const auto = char.autoPotion;
  let inventory = char.inventory;
  let currentHealth = char.currentHealth;
  let currentMana = char.currentMana;
  if (!auto?.enabled || currentHealth <= 0) return { inventory, currentHealth, currentMana, log };

  if (stats.health > 0 && (currentHealth / stats.health) * 100 <= auto.healthPct) {
    const found = findBestPotion(inventory, 'health');
    if (found) {
      currentHealth = Math.min(stats.health, currentHealth + found.item.stats.health);
      inventory = inventory
        .map((i, idx) => (idx === found.idx ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      log = pushLog(log, `Poção automática: você usou ${found.item.name} e recuperou ${found.item.stats.health} de vida.`);
    }
  }

  if (stats.mana > 0 && (currentMana / stats.mana) * 100 <= auto.manaPct) {
    const found = findBestPotion(inventory, 'mana');
    if (found) {
      currentMana = Math.min(stats.mana, currentMana + found.item.stats.mana);
      inventory = inventory
        .map((i, idx) => (idx === found.idx ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      log = pushLog(log, `Poção automática: você usou ${found.item.name} e recuperou ${found.item.stats.mana} de mana.`);
    }
  }

  return { inventory, currentHealth, currentMana, log };
}

const MONSTER_TRANSITION_MS = 2000;

// Derrota de um monstro: XP, gold, drops (respeitando blacklist), auto-come comida e
// sobe de nível — usado tanto por PLAYER_ATTACK (golpe normal) quanto por SPELL_CAST
// (magia matando o monstro), pra não duplicar essa lógica toda em dois lugares.
function defeatMonster(char, currentMonster, log, { lifestealHeal = 0, selfDamage = 0 } = {}) {
  const boosted = getDailyBoostedMonster().name === currentMonster.name;
  const boostMult = boosted ? BOOSTED_MULTIPLIER : 1;
  const { gold: rawGold, items: rawItemDrops } = rollLoot(currentMonster);
  const goldDrop = Math.round(rawGold * boostMult);
  const xpGain = Math.round(currentMonster.xp * boostMult);

  log = pushLog(log, `${currentMonster.name} derrotado! +${xpGain} XP.${boosted ? ' (boosted do dia!)' : ''}`);
  if (goldDrop > 0) log = pushLog(log, `+${goldDrop} gold.`);

  // Itens na blacklist simplesmente não são pegos — nem entram na checagem de
  // peso/mochila cheia, como se o item nunca tivesse caído. Uma entrada pode
  // ter raridade mínima (ex: "Torch" só é bloqueada abaixo de épico).
  const blacklistMap = new Map((char.itemBlacklist ?? []).map((e) => [e.name, e.minRarity]));
  const itemDrops = rawItemDrops.filter((item) => {
    if (!blacklistMap.has(item.name)) return true;
    const minRarity = blacklistMap.get(item.name);
    return minRarity ? rarityAtLeast(item.rarity, minRarity) : false;
  });

  const charStats = computeFinalStats(char);

  // Com comer automático ligado, comida nem entra na checagem de peso — ela é
  // comida na hora, nunca fica ocupando espaço, então "mochila cheia" não deve
  // bloquear um alimento que nem vai ficar guardado.
  const foodDrops = char.autoEat ? itemDrops.filter((i) => FOOD_CATEGORIES.has(i.category)) : [];
  const nonFoodDrops = char.autoEat ? itemDrops.filter((i) => !FOOD_CATEGORIES.has(i.category)) : itemDrops;

  const { inventory: mergedInventory, rejected } = mergeLoot(char.inventory, nonFoodDrops, charStats.capacity);
  for (const item of nonFoodDrops) {
    const wasRejected = rejected.includes(item);
    log = pushLog(
      log,
      wasRejected
        ? `Mochila cheia! Você deixou ${item.name} x${item.quantity} para trás.`
        : `Você encontrou: ${item.name} x${item.quantity}.`,
    );
  }

  let inventoryAfterLoot = mergedInventory;
  let satiety = char.satiety;
  for (const food of foodDrops) {
    for (let i = 0; i < food.quantity; i++) satiety = eatFood(satiety, food.category);
    satiety.foodName = satiety.foodName ?? food.name;
    log = pushLog(
      log,
      `Você comeu ${food.name} x${food.quantity} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`,
    );
  }

  const { xp, level, levelBatches, log: logAfterXp, leveledUp } = applyXpGain(char, xpGain, log);
  log = logAfterXp;

  const zoneKills = { ...char.zoneKills, [char.zoneId]: (char.zoneKills[char.zoneId] ?? 0) + 1 };
  const monsterKills = {
    ...char.monsterKills,
    [currentMonster.name]: (char.monsterKills?.[currentMonster.name] ?? 0) + 1,
  };

  const updatedChar = {
    ...char,
    xp,
    level,
    levelBatches,
    gold: char.gold + goldDrop,
    kills: char.kills + 1,
    zoneKills,
    monsterKills,
    totalGoldEarned: char.totalGoldEarned + goldDrop,
    totalXpEarned: char.totalXpEarned + xpGain,
    inventory: inventoryAfterLoot,
    satiety,
  };
  const newStats = computeFinalStats(updatedChar);

  // Bloodbath (Arma Grande): matar um monstro cura % da vida MÁXIMA dele, cap 50.
  const bloodbathHeal = charStats.bloodbathHealPercent > 0
    ? Math.min(BLOODBATH_HEAL_CAP, currentMonster.maxHealth * (charStats.bloodbathHealPercent / 100))
    : 0;
  // Higher Ruling (Arma Grande): o golpe que MATA o monstro causa Magic×5 em você
  // mesmo — risco real do talento, independente de ter sido morto por golpe ou magia.
  const higherRulingSelfDamage = charStats.higherRulingActive ? charStats.magic * HIGHER_RULING_SELF_DAMAGE_MULT : 0;
  const totalLifestealHeal = lifestealHeal + bloodbathHeal;
  const totalSelfDamage = selfDamage + higherRulingSelfDamage;
  if (bloodbathHeal > 0) log = pushLog(log, `Bloodbath: +${bloodbathHeal.toFixed(1)} de vida.`);
  if (higherRulingSelfDamage > 0) log = pushLog(log, `Higher Ruling: você recebeu ${higherRulingSelfDamage.toFixed(1)} de dano pelo golpe de misericórdia.`);

  // Subir de nível enche vida e mana por completo — igual ao jogo real.
  // Dark Blade / feitiços com custo de HP podem causar dano em você mesmo — não
  // deixamos matar nessa hora pra não duplicar a lógica de morte/respawn do
  // MONSTER_ATTACK, só reduz até o mínimo de 1 de vida.
  updatedChar.currentHealth = leveledUp
    ? newStats.health
    : Math.max(1, Math.min(newStats.health, char.currentHealth + totalLifestealHeal) - totalSelfDamage);
  updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);

  return {
    character: updatedChar,
    monster: pickMonster(char.zoneId),
    log,
    combatPauseUntil: Date.now() + MONSTER_TRANSITION_MS,
  };
}

// Todo o combate roda num único reducer, então "dano no monstro + spawn do próximo"
// acontece como UMA transição de estado atômica — não há como um tick ler um monstro
// desatualizado (a antiga versão guardava character/monster em dois useState + refs
// separados, e sob timers atrasados/acumulados isso podia fazer um hit "vazar" pro
// monstro seguinte já com vida baixa).
function reducer(state, action) {
  switch (action.type) {
    case 'CREATE_CHARACTER': {
      const character = createCharacter(action.name);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `${character.name} chegou como Squire! Junte ${VOCATION_COST} gold pra escolher uma vocação.`),
        autoCombat: false,
      };
    }

    case 'CHOOSE_VOCATION': {
      const char = state.character;
      if (!char || char.class !== 'Squire' || char.gold < VOCATION_COST) return state;
      if (!['Knight', 'Rogue', 'Mage'].includes(action.vocation)) return state;

      const updatedChar = { ...char, class: action.vocation, gold: char.gold - VOCATION_COST };
      const s = computeFinalStats(updatedChar);
      updatedChar.currentHealth = Math.min(s.health, updatedChar.currentHealth);
      updatedChar.currentMana = Math.min(s.mana, updatedChar.currentMana);

      return {
        ...state,
        character: updatedChar,
        log: pushLog(
          state.log,
          `Você pagou ${VOCATION_COST} gold e se tornou ${action.vocation}! Essa escolha é definitiva.`,
        ),
      };
    }

    case 'LOAD_REMOTE_CHARACTER': {
      const character = migrateCharacter(action.character);
      return {
        character,
        monster: pickMonster(character.zoneId),
        log: pushLog([], `Personagem sincronizado! Bem-vindo de volta, ${character.name}.`),
        autoCombat: character.autoCombat && character.currentHealth > 0,
      };
    }

    case 'RESET':
      return { character: null, monster: null, log: [], autoCombat: false };

    case 'SET_AUTO_COMBAT': {
      const value = typeof action.valueOrFn === 'function' ? action.valueOrFn(state.autoCombat) : action.valueOrFn;
      // Guarda no personagem também (não só no estado local) — é o que permite
      // salvar isso no localStorage/nuvem e retomar a caçada ao reabrir o jogo.
      const character = state.character ? { ...state.character, autoCombat: value } : state.character;
      return { ...state, character, autoCombat: value };
    }

    case 'SET_AUTO_EAT': {
      const char = state.character;
      if (!char) return state;
      // Ligar a opção já come na hora toda comida que estiver parada na mochila —
      // não só a que chegar depois.
      let inventory = char.inventory;
      let satiety = char.satiety;
      let log = state.log;
      if (action.enabled) {
        const eaten = autoEatAllFood(inventory, satiety, log);
        inventory = eaten.inventory;
        satiety = eaten.satiety;
        log = eaten.log;
      }
      return { ...state, character: { ...char, autoEat: action.enabled, inventory, satiety }, log };
    }

    case 'SET_AUTO_POTION': {
      const char = state.character;
      if (!char) return state;
      return { ...state, character: { ...char, autoPotion: { ...char.autoPotion, ...action.settings } } };
    }

    // Cada magia de cura tem seu próprio limiar de vida (%) pra entrar em ação sozinha
    // — sem isso, o auto-cast curaria toda vez que o cooldown liberasse, mesmo com a
    // vida quase cheia, só pra recuperar 5% de quase nada.
    case 'SET_SPELL_HEAL_THRESHOLD': {
      const char = state.character;
      if (!char) return state;
      return {
        ...state,
        character: { ...char, spellHealThresholds: { ...char.spellHealThresholds, [action.spellId]: action.pct } },
      };
    }

    // Ler um livro de magia ensina o feitiço PRA SEMPRE (consome 1 unidade do livro,
    // igual ao jogo real) — não precisa manter o livro guardado depois disso.
    case 'LEARN_SPELL': {
      const char = state.character;
      if (!char) return state;
      const spell = SPELLS_BY_ID[action.spellId];
      if (!spell || char.learnedSpells.includes(action.spellId)) return state;

      // Procura o livro na Mochila PRIMEIRO, e no Banco como alternativa — o jogador
      // pode ter guardado o livro no banco antes de perceber que precisava aprender
      // com ele, e isso fazia "aprender" recusar mesmo com o item na conta.
      const bookIdx = char.inventory.findIndex((i) => i.name === spell.book && i.quantity > 0);
      if (bookIdx >= 0) {
        const inventory = char.inventory
          .map((i, idx) => (idx === bookIdx ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0);
        return {
          ...state,
          character: { ...char, inventory, learnedSpells: [...char.learnedSpells, action.spellId] },
          log: pushLog(state.log, `Você aprendeu a magia ${spell.id}!`),
        };
      }

      const bankIdx = char.bank.findIndex((i) => i.name === spell.book && i.quantity > 0);
      if (bankIdx >= 0) {
        const bank = char.bank
          .map((i, idx) => (idx === bankIdx ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0);
        return {
          ...state,
          character: { ...char, bank, learnedSpells: [...char.learnedSpells, action.spellId] },
          log: pushLog(state.log, `Você aprendeu a magia ${spell.id}! (livro estava no banco)`),
        };
      }

      return { ...state, log: pushLog(state.log, `Você precisa ter ${spell.book} na mochila ou no banco pra aprender essa magia.`) };
    }

    case 'EQUIP_SPELL': {
      const char = state.character;
      if (!char) return state;
      if (!char.learnedSpells.includes(action.spellId)) return state;
      if (action.slotIndex < 0 || action.slotIndex >= SPELL_SLOTS) return state;
      // Uma magia só pode ocupar um slot por vez — se já tava equipada em outro, tira de lá.
      const equippedSpells = char.equippedSpells.map((s, idx) => {
        if (idx === action.slotIndex) return action.spellId;
        return s === action.spellId ? null : s;
      });
      return { ...state, character: { ...char, equippedSpells } };
    }

    case 'UNEQUIP_SPELL': {
      const char = state.character;
      if (!char) return state;
      const equippedSpells = char.equippedSpells.map((s, idx) => (idx === action.slotIndex ? null : s));
      return { ...state, character: { ...char, equippedSpells } };
    }

    case 'SET_AUTO_CAST_SPELLS': {
      const char = state.character;
      if (!char) return state;
      return { ...state, character: { ...char, autoCastSpells: action.enabled } };
    }

    // Roda num relógio próprio (ver useGameState() mais abaixo), independente do
    // ataque físico — cada magia equipada tem seu próprio cooldown (spellCooldowns,
    // fora do personagem: é estado de combate efêmero, não precisa ser salvo).
    case 'SPELL_CAST': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0 || !char.autoCastSpells) return state;
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);
      const now = Date.now();
      const equipped = char.equippedSpells.filter(Boolean);
      if (equipped.length === 0) return state;

      let spellCooldowns = state.spellCooldowns;
      let workingChar = char;
      let workingMonster = currentMonster;
      let log = state.log;
      let combatPauseUntil = state.combatPauseUntil;

      for (const spellId of equipped) {
        const spell = SPELLS_BY_ID[spellId];
        if (!spell) continue;
        if (!workingMonster || workingChar.currentHealth <= 0) break;
        if ((spellCooldowns[spellId] ?? 0) > now) continue;
        if (!canCastSpell(spell, charStats)) continue;

        // Custo de mana final: soma todos os descontos PERCENTUAIS que se aplicam à
        // ESCOLA dessa magia (Cura/Blade-Highlander/Death-Darkness Embrace/Heal-Light-
        // Holy-Darkness Embrace/Earth-Water-Light-Friend of Apogea) + desconto global de
        // luvas + Supernatural Gamble, depois subtrai os descontos FIXOS (Fencing
        // Classes/Royal Marks) por cima — nessa ordem (% primeiro, flat depois).
        let manaCostMultiplier = 1;
        if (spell.kind === 'heal' && !spell.hpCast) {
          manaCostMultiplier -= (charStats.healManaDiscountPercent ?? 0) / 100;
        }
        if (spell.type === 'Blade' && charStats.highlanderActive) {
          manaCostMultiplier -= HIGHLANDER_MANA_DISCOUNT_PCT / 100;
        }
        if (charStats.friendOfApogeaActive && ['Earth', 'Water', 'Light'].includes(spell.type)) {
          manaCostMultiplier -= FRIEND_OF_APOGEA_MANA_DISCOUNT_PCT / 100;
        }
        if (charStats.darknessEmbraceActive) {
          if (spell.type === 'Death') manaCostMultiplier -= DARKNESS_EMBRACE_DEATH_DISCOUNT_PCT / 100;
          if (['Heal', 'Light', 'Holy'].includes(spell.type)) manaCostMultiplier += DARKNESS_EMBRACE_HEAL_SURCHARGE_PCT / 100;
        }
        manaCostMultiplier -= (charStats.globalManaDiscountPercent ?? 0) / 100;
        // Supernatural Gamble (Luva, capstone): -50% de mana em TODAS as magias.
        if (charStats.supernaturalGambleActive) manaCostMultiplier -= SUPERNATURAL_GAMBLE_MANA_DISCOUNT_PCT / 100;
        manaCostMultiplier = Math.max(0.05, manaCostMultiplier);
        let effectiveManaCost = spell.manaCost * manaCostMultiplier;
        // Fencing Classes (Espada): magias Blade custam Mana fixa a menos.
        if (spell.type === 'Blade' && charStats.bladeManaDiscountFlat > 0) {
          effectiveManaCost = Math.max(1, effectiveManaCost - charStats.bladeManaDiscountFlat);
        }
        // Royal Marks (Armadura Pesada): magias Heal/Light custam Mana fixa a menos.
        if (['Heal', 'Light'].includes(spell.type) && charStats.healLightFlatDiscount > 0) {
          effectiveManaCost = Math.max(1, effectiveManaCost - charStats.healLightFlatDiscount);
        }

        const costPool = spell.hpCast ? workingChar.currentHealth : workingChar.currentMana;
        if (costPool < effectiveManaCost) continue;

        // Magia de cura só entra em ação quando a vida cair pra igual ou abaixo do
        // limiar configurado pelo jogador (senão ficaria curando 5% de quase nada toda
        // vez que o cooldown liberasse, mesmo com a vida praticamente cheia).
        if (spell.kind === 'heal') {
          const healthPct = (workingChar.currentHealth / charStats.health) * 100;
          const threshold = char.spellHealThresholds?.[spellId] ?? DEFAULT_HEAL_THRESHOLD_PCT;
          if (healthPct > threshold) continue;
        }

        // Electric Nature (todas) + Gallop's Fall (Terra/Água) + Royal Attire
        // (Defense/Conjure) + Prima Draw (Blade/Physical) reduzem o cooldown real
        // daquela magia — somam entre si, até um teto de 90% pra nunca zerar de vez.
        let cdReductionPct = charStats.spellCooldownReductionPercent ?? 0;
        if (['Earth', 'Water'].includes(spell.type)) cdReductionPct += charStats.earthWaterCooldownReductionPercent ?? 0;
        if (['Defense', 'Conjure'].includes(spell.type)) cdReductionPct += charStats.defenseConjureCooldownReductionPercent ?? 0;
        if (['Blade', 'Physical'].includes(spell.type) && charStats.primaDrawActive) cdReductionPct += PRIMA_DRAW_CD_REDUCTION_PCT;
        cdReductionPct = Math.min(90, cdReductionPct);
        spellCooldowns = { ...spellCooldowns, [spellId]: now + spell.cooldownMs * (1 - cdReductionPct / 100) };

        // Bow/crossbow equipado: Swiftstride — cast de magia Arrow tem chance de
        // disparar 1 ataque básico extra imediato contra o alvo atual.
        const bowEquipped = ['weapon', 'offhand'].some((slot) => char.equipment?.[slot]?.category === 'bow');
        if (bowEquipped && spell.type === 'Arrow' && charStats.arrowExtraHitChance > 0 && Math.random() < charStats.arrowExtraHitChance) {
          const extraDamage = computeExtraBasicHitDamage(charStats, workingMonster, workingChar.monsterKills?.[workingMonster.name]);
          log = pushLog(log, `Swiftstride: golpe extra causou ${extraDamage.toFixed(1)} de dano em ${workingMonster.name}.`);
          const monsterHealthAfterExtra = Math.max(0, workingMonster.currentHealth - extraDamage);
          if (monsterHealthAfterExtra <= 0) {
            const result = defeatMonster(workingChar, workingMonster, log);
            workingChar = result.character;
            workingMonster = result.monster;
            log = result.log;
            combatPauseUntil = result.combatPauseUntil;
            continue;
          }
          workingMonster = { ...workingMonster, currentHealth: monsterHealthAfterExtra };
        }

        // Gaff Hack (Adaga): sem magia Mystic/Time nesse jogo, qualquer cast tem chance
        // de ativar o buff de 1 uso pro próximo golpe (extra hit).
        if (charStats.castAttackBurstChance > 0 && Math.random() < charStats.castAttackBurstChance) {
          workingChar = { ...workingChar, castAttackBurstBuff: true };
        }
        // Unnatural Flow (Luva): QUALQUER cast carrega o próximo golpe com Dano
        // Verdadeiro extra — mesmo buff do Charge the Staff/Wrecking It, soma.
        if (charStats.gloveNextAttackTrueDamage > 0) {
          workingChar = { ...workingChar, staffChargeBuff: (workingChar.staffChargeBuff ?? 0) + charStats.gloveNextAttackTrueDamage };
        }
        // Supernatural Gamble (Luva, capstone): 50% de chance da magia "explodir" e
        // causar em você mesmo metade do custo de mana que você pagou, em dano.
        if (charStats.supernaturalGambleActive && !spell.hpCast && Math.random() < SUPERNATURAL_GAMBLE_SELF_DAMAGE_CHANCE) {
          const selfDmg = effectiveManaCost / 2;
          workingChar = { ...workingChar, currentHealth: Math.max(1, workingChar.currentHealth - selfDmg) };
          log = pushLog(log, `Supernatural Gamble: a magia explodiu! Você sofreu ${selfDmg.toFixed(1)} de dano.`);
        }
        // Arcane Trickster (Luva): QUALQUER cast dá Escudo Mágico (Mana máxima / 10, cap 100).
        if (charStats.arcaneTricksterShieldGain > 0) {
          const newShield = Math.min(MAGIC_STEEL_SHIELD_CAP, (workingChar.shieldPoints ?? 0) + charStats.arcaneTricksterShieldGain);
          workingChar = { ...workingChar, shieldPoints: newShield };
          log = pushLog(log, `Arcane Trickster: +${charStats.arcaneTricksterShieldGain.toFixed(1)} de escudo.`);
        }

        if (spell.kind === 'heal') {
          const missingHealth = charStats.health - workingChar.currentHealth;
          // Magic entra como multiplicador da cura (balanceamento nosso, a pedido do
          // usuário — a fonte real não faz Magic escalar o Heal, só magias de dano):
          // cada 100 pontos de Magic dobra a cura. Magic Touch (Orbe) some por cima.
          const magicMultiplier = 1 + (charStats.magic ?? 0) / HEAL_MAGIC_MULTIPLIER_DIVISOR;
          // Blessed Plate (Armadura Pesada): abaixo de 35% de vida, cura do próprio
          // feitiço Heal +35% mais forte — soma com Magic Touch (Orbe).
          let healPowerBonusPercent = charStats.healPowerBonusPercent ?? 0;
          if (charStats.blessedPlateHealBoostActive && (workingChar.currentHealth / charStats.health) * 100 < BLESSED_PLATE2_HEALTH_THRESHOLD_PCT) {
            healPowerBonusPercent += BLESSED_PLATE2_HEAL_BONUS_PCT;
          }
          const healAmount = missingHealth * ((spell.missingHealthPct ?? 0) / 100) * magicMultiplier * (1 + healPowerBonusPercent / 100);
          const currentHealth = spell.hpCast
            ? Math.max(1, workingChar.currentHealth - effectiveManaCost)
            : workingChar.currentHealth;
          const currentMana = spell.hpCast ? workingChar.currentMana : workingChar.currentMana - effectiveManaCost;
          workingChar = {
            ...workingChar,
            currentHealth: Math.min(charStats.health, currentHealth + healAmount),
            currentMana,
          };
          log = pushLog(log, `Você conjurou ${spell.id} e recuperou ${healAmount.toFixed(1)} de vida.`);
          // Etched Gems (Escudo): gastar mais de 50% da Mana máxima nesse cast dá Escudo Mágico.
          if (charStats.etchedGemsActive && !spell.hpCast && effectiveManaCost > charStats.mana * (ETCHED_GEMS_MANA_SPENT_THRESHOLD_PCT / 100)) {
            const newShield = addShieldGain(workingChar.shieldPoints, ETCHED_GEMS_SHIELD_GAIN, charStats.onyxScreenActive);
            workingChar = { ...workingChar, shieldPoints: newShield };
            log = pushLog(log, `Etched Gems: escudo agora em ${newShield.toFixed(1)}.`);
          }
          // Innervated Mana (Escudo): conjurar QUALQUER magia com sucesso zera sua Mana.
          if (charStats.innervatedManaActive) {
            workingChar = { ...workingChar, currentMana: 0 };
            log = pushLog(log, 'Innervated Mana: sua Mana foi zerada.');
          }
          continue;
        }

        const { avg: avgWeaponDamage } = computeDamageRoll(charStats);
        // Dano base fixo somado ANTES da mitigação de armadura: Conflagrated Mind
        // (Fogo), Thorough Judgment (Holy), Cannon Ball (só na magia Thrash).
        let flatSpellBonus = 0;
        if (spell.type === 'Fire') flatSpellBonus += charStats.fireFlatDamage ?? 0;
        if (spell.type === 'Holy') flatSpellBonus += charStats.holyFlatDamage ?? 0;
        if (spell.id === 'Thrash' && charStats.cannonBallActive) flatSpellBonus += CANNON_BALL_FLAT_DAMAGE;
        const rawDamage = computeSpellEffect(spell, charStats, avgWeaponDamage) + flatSpellBonus;
        // Fórmula real de Armadura, com Resonant Blow (armorPenFlat) subtraindo um
        // valor FIXO de Armor antes do armorPenPercent entrar como redução percentual.
        const armorAfterFlat = Math.max(0, workingMonster.armor - (charStats.armorPenFlat ?? 0));
        const effectiveArmor = Math.max(0, armorAfterFlat * (1 - (charStats.armorPenPercent ?? 0) / 100));
        let spellDamage = Math.max(1, (rawDamage - effectiveArmor / 2) / (1 + effectiveArmor / 100));
        // Bullseye/Deferred Reverence: magia Arrow ou Blade acerta = Dano Verdadeiro
        // adicional (ignora armadura, por isso soma DEPOIS da mitigação) + cura.
        let arrowBladeHealAmount = 0;
        if (['Arrow', 'Blade'].includes(spell.type)) {
          spellDamage += charStats.arrowBladeTrueDamage ?? 0;
          arrowBladeHealAmount = charStats.arrowBladeHeal ?? 0;
        }

        const currentHealth = spell.hpCast ? Math.max(1, workingChar.currentHealth - effectiveManaCost) : workingChar.currentHealth;
        const currentMana = spell.hpCast ? workingChar.currentMana : workingChar.currentMana - effectiveManaCost;
        workingChar = { ...workingChar, currentHealth, currentMana };

        if (arrowBladeHealAmount > 0) {
          workingChar = { ...workingChar, currentHealth: Math.min(charStats.health, workingChar.currentHealth + arrowBladeHealAmount) };
          log = pushLog(log, `Deferred Reverence: +${arrowBladeHealAmount.toFixed(1)} de vida.`);
        }

        // Lifesteal de magia: Vampiric Bite (própria magia, % não documentada, nossa
        // estimativa) + Pondering It (Orbe, Spellvamp real por rank) + Prima Draw
        // (Espada, +10% Spellvamp) — somam.
        let effectiveSpellLifestealPct = charStats.spellLifestealPercent ?? 0;
        if (charStats.primaDrawActive) effectiveSpellLifestealPct += PRIMA_DRAW_SPELLVAMP_PCT;
        const totalSpellLifestealPct = (spell.lifestealPercent ?? 0) + effectiveSpellLifestealPct;
        if (totalSpellLifestealPct > 0) {
          const spellLifesteal = spellDamage * (totalSpellLifestealPct / 100);
          workingChar = { ...workingChar, currentHealth: Math.min(charStats.health, workingChar.currentHealth + spellLifesteal) };
          log = pushLog(log, `${spell.id}: lifesteal +${spellLifesteal.toFixed(1)} de vida.`);
        }

        // Diamond Skin (Orbe): conjurar magia de Energia, Physical ou Arrow dá escudo
        // (valor do rank atual), empilhando até um cap FLAT (não mais "3 stacks").
        if (['Energy', 'Physical', 'Arrow'].includes(spell.type) && charStats.diamondSkinValue > 0) {
          const cap = charStats.onyxScreenActive ? ONYX_SCREEN_SHIELD_CAP : DIAMOND_SKIN_SHIELD_CAP;
          const gain = charStats.onyxScreenActive ? charStats.diamondSkinValue * 2 : charStats.diamondSkinValue;
          const newShield = Math.min(cap, (workingChar.shieldPoints ?? 0) + gain);
          if (newShield !== workingChar.shieldPoints) {
            workingChar = { ...workingChar, shieldPoints: newShield };
            log = pushLog(log, `Diamond Skin: +${gain.toFixed(1)} de escudo (total ${newShield.toFixed(1)}).`);
          }
        }

        // Etched Gems (Escudo): gastar mais de 50% da Mana máxima nesse cast dá Escudo Mágico.
        if (charStats.etchedGemsActive && !spell.hpCast && effectiveManaCost > charStats.mana * (ETCHED_GEMS_MANA_SPENT_THRESHOLD_PCT / 100)) {
          const newShield = addShieldGain(workingChar.shieldPoints, ETCHED_GEMS_SHIELD_GAIN, charStats.onyxScreenActive);
          workingChar = { ...workingChar, shieldPoints: newShield };
          log = pushLog(log, `Etched Gems: escudo agora em ${newShield.toFixed(1)}.`);
        }

        // Charge the Stick (Cajado): cast Elemental com Cajado/Varinha equipado
        // carrega o PRÓXIMO golpe com Dano Verdadeiro = % da Mana gasta nesse cast.
        const staffOrWandEquipped = ['weapon', 'offhand'].some((slot) => char.equipment?.[slot]?.category === 'staff');
        if (staffOrWandEquipped && STAFF_ELEMENTAL_SPELL_TYPES.includes(spell.type) && charStats.staffChargePct > 0) {
          const chargeAmount = effectiveManaCost * charStats.staffChargePct;
          workingChar = { ...workingChar, staffChargeBuff: (workingChar.staffChargeBuff ?? 0) + chargeAmount };
          log = pushLog(log, `Charge the Stick: +${chargeAmount.toFixed(1)} de dano verdadeiro no próximo golpe.`);
        }
        // Frantic Conjury: cast de Fogo OU Energia tem chance de fazer o PRÓXIMO golpe
        // conjurar Conjure Fire de graça.
        if (['Fire', 'Energy'].includes(spell.type) && charStats.franticConjuryChance > 0 && Math.random() < charStats.franticConjuryChance) {
          workingChar = { ...workingChar, franticConjuryBuff: true };
          log = pushLog(log, 'Frantic Conjury: seu próximo golpe vai conjurar Conjure Fire de graça!');
        }

        // Innervated Mana (Escudo): conjurar QUALQUER magia com sucesso zera sua Mana —
        // risco real do talento, aplicado por último (depois de tudo que já usou a mana).
        if (charStats.innervatedManaActive) {
          workingChar = { ...workingChar, currentMana: 0 };
          log = pushLog(log, 'Innervated Mana: sua Mana foi zerada.');
        }

        log = pushLog(log, `Você conjurou ${spell.id} e causou ${spellDamage.toFixed(1)} de dano em ${workingMonster.name}.`);

        const monsterHealth = Math.max(0, workingMonster.currentHealth - spellDamage);
        if (monsterHealth <= 0) {
          const result = defeatMonster(workingChar, workingMonster, log);
          workingChar = result.character;
          workingMonster = result.monster;
          log = result.log;
          combatPauseUntil = result.combatPauseUntil;
        } else {
          workingMonster = { ...workingMonster, currentHealth: monsterHealth };
        }
      }

      if (workingChar === char && workingMonster === currentMonster && spellCooldowns === state.spellCooldowns) {
        return state;
      }

      // Gasto de mana/HP em magia é o outro grande motivo de precisar de poção
      // automática além do dano do monstro — checa de novo aqui no final do cast.
      const potionResult = autoUsePotions(workingChar, charStats, log);
      workingChar = { ...workingChar, inventory: potionResult.inventory, currentHealth: potionResult.currentHealth, currentMana: potionResult.currentMana };
      log = potionResult.log;

      return { ...state, character: workingChar, monster: workingMonster, log, combatPauseUntil, spellCooldowns };
    }

    // Ataque do jogador e ataque do monstro rodam em RELÓGIOS INDEPENDENTES (ver
    // useGameState() mais abaixo), cada um no seu próprio intervalo real — se sua
    // Attack Speed for o dobro da do monstro, você bate 2x pra cada 1x dele, de verdade,
    // e não só "o combate passa mais rápido" (como era antes, quando os dois hits
    // aconteciam sempre juntos no mesmo tick).
    case 'PLAYER_ATTACK': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0) return state;
      // Pausa de 2s depois de derrotar um monstro, antes do próximo combate começar —
      // dá um respiro pra vida regenerar entre uma criatura e outra.
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);

      // Ataque básico com cajado (ou na mão secundária) consome mana — a fonte real
      // não documenta o valor exato, então usamos um custo fixo homebrew moderado.
      // (Staff Mastery agora dá Dano Verdadeiro fixo, não mais chance de tiro grátis.)
      const staffEquipped = char.equipment?.weapon?.category === 'staff' || char.equipment?.offhand?.category === 'staff';
      const staffManaCost = staffEquipped ? Math.min(char.currentMana, STAFF_BASIC_ATTACK_MANA_COST) : 0;

      const healthPct = (char.currentHealth / charStats.health) * 100;
      // Berserker (Arma Grande): a cada 10% de vida faltando, +1 Dano e +1% Lifeleech.
      const berserkerSteps = charStats.berserkerScalingActive ? Math.floor((100 - healthPct) / 10) : 0;

      // Um golpe: dano físico normal (com crítico e mitigação de armadura) + Dano
      // Verdadeiro fixo (Staff Mastery/Foreseen Decay/Poison Shiv/Gemmed Hilt, já
      // somados em trueDamageFlat) + os procs específicos de arma/armadura. Talentos só
      // entram se o requisito de equipamento ainda estiver ativo agora mesmo — troque a
      // arma e eles ligam/desligam na hora.
      function rollHit() {
        const isCrit = Math.random() < (charStats.critChance ?? 0);
        // Cada golpe sorteia um valor dentro do range min-máx real (igual a barra
        // "Dano por golpe X-Y" mostra) — usar sempre a média fazia todo hit sair com o
        // mesmo número, sem a variação que o jogo real tem.
        const { min: minDamage, max: maxDamage } = computeDamageRoll(charStats);
        let dmg = minDamage + Math.random() * (maxDamage - minDamage);
        if (isCrit) dmg *= charStats.critMultiplier ?? 1;
        if (berserkerSteps > 0) dmg += berserkerSteps;
        // Higher Ruling (Arma Grande): +1 Dano flat por ponto de Magic final.
        if (charStats.higherRulingActive) dmg += Math.floor(charStats.magic);
        // Bestiário: cada estrela ganha nessa criatura específica (marcos de abates) dá
        // +5% de dano só contra ela.
        dmg *= monsterDamageMultiplier(char.monsterKills?.[currentMonster.name] ?? 0);

        // Fórmula real de Armadura (apogean.eu/lists/formulae): (Dano - Armadura/2) /
        // (1 + Armadura/100) — tem uma parte flat ANTES da percentual, não só a %.
        // Resonant Blow (Espada): ignora um valor FIXO de Armor antes da % de armorPen.
        const armorAfterFlat = Math.max(0, currentMonster.armor - (charStats.armorPenFlat ?? 0));
        const effectiveArmor = Math.max(0, armorAfterFlat * (1 - (charStats.armorPenPercent ?? 0) / 100));
        // One With Apogea (Luva): "você não causa mais dano físico" — zera o físico de
        // verdade (não é o mínimo de 1 de sempre), a mana vira todo o dano em troca.
        const damage = charStats.oneWithApogeaGloveActive
          ? 0
          : Math.max(1, (dmg - effectiveArmor / 2) / (1 + effectiveArmor / 100));

        // Dano Verdadeiro fixo de TODO golpe (trueDamageFlat) — Foreseen Decay dá 15%
        // de chance desse valor acontecer 2x.
        let trueDamage = charStats.trueDamageFlat ?? 0;
        if (charStats.foreseenDecayActive && trueDamage > 0 && Math.random() < FORESEEN_DECAY_DOUBLE_CHANCE) {
          trueDamage *= 2;
        }
        // Looming Dread (Armadura Pesada): +1 Dano Verdadeiro a cada N de Armor final.
        if (charStats.loomingDreadArmorDivisor) {
          trueDamage += Math.floor(charStats.armor / charStats.loomingDreadArmorDivisor);
        }
        // Smite (Arma Grande, homebrew — real seria "ao atordoar", remapeado pra
        // crítico, já que não existe stagger nesse jogo): crítico causa Dano Verdadeiro extra.
        if (isCrit && charStats.smiteOnCritTrueDamage > 0) {
          trueDamage += charStats.smiteOnCritTrueDamage;
        }
        // Precise Tear (Arma Grande): chance de Dano Verdadeiro = % da vida MÁXIMA do alvo, cap.
        if (charStats.preciseTearActive && Math.random() < PRECISE_TEAR_CHANCE) {
          trueDamage += Math.min(PRECISE_TEAR_CAP, currentMonster.maxHealth * (PRECISE_TEAR_HEALTH_PCT / 100));
        }
        // Explosive Ammo / Mahogany Build (Arco) / Overwhelming Force (Arma Grande):
        // sem área de efeito nesse jogo, aproximados como chance de dano bônus no golpe
        // (cada fonte rolada independente).
        if (charStats.bowExplosiveChance && Math.random() < charStats.bowExplosiveChance) {
          trueDamage += (maxDamage - minDamage) * BOW_ELEMENTAL_EXTRA_PROC_MAGNITUDE;
        }
        if (charStats.bowSecondaryProcChance && Math.random() < charStats.bowSecondaryProcChance) {
          trueDamage += (maxDamage - minDamage) * BOW_ELEMENTAL_EXTRA_PROC_MAGNITUDE;
        }
        if (charStats.overwhelmingForceChance && Math.random() < charStats.overwhelmingForceChance) {
          trueDamage += (maxDamage - minDamage) * BOW_ELEMENTAL_EXTRA_PROC_MAGNITUDE;
        }
        // Seer Apparel (Luva): +5 de Dano Verdadeiro fixo por golpe (real).
        if (charStats.seerApparelActive) trueDamage += SEER_APPAREL_TRUE_DAMAGE;
        // Drunk Style (Luva): chance de "Fire Breath" — magia sem fórmula documentada,
        // aproximada (homebrew) como estouro de dano verdadeiro.
        if (charStats.drunkStyleActive && Math.random() < DRUNK_STYLE_FIRE_BREATH_CHANCE) {
          trueDamage += (maxDamage - minDamage) * 0.5;
        }
        // One With Apogea (Luva): +1 de Dano Verdadeiro a cada 35 de Mana máxima.
        if (charStats.oneWithApogeaGloveActive) {
          trueDamage += Math.floor(charStats.mana / ONE_WITH_APOGEA_GLOVE_MANA_DIVISOR);
        }
        // Dark Blade Plus (Adaga): dobra TODO Dano Verdadeiro do golpe (e você recebe
        // essa quantia de volta).
        if (charStats.trueDamageDoubled) trueDamage *= 2;
        const selfTrueDamage = charStats.trueDamageDoubled && trueDamage > 0 ? trueDamage : 0;

        // Core Strength (Arma Grande): gasta 5% da Vida MÁXIMA em Dano Verdadeiro, cap 20.
        let coreStrengthSelfDamage = 0;
        if (charStats.coreStrengthActive) {
          coreStrengthSelfDamage = Math.min(CORE_STRENGTH_TRUE_DAMAGE_CAP, charStats.health * (CORE_STRENGTH_HP_SPEND_PCT / 100));
          trueDamage += coreStrengthSelfDamage;
        }

        // Edge Life (Espada): abaixo do limiar de vida, cura +2 por golpe de espada.
        let edgeLifeHeal = 0;
        if (charStats.edgeLifeThresholdPercent && healthPct < charStats.edgeLifeThresholdPercent) {
          edgeLifeHeal = EDGE_LIFE_HEAL_FLAT;
        }

        // The Expert (Espada): chance de Escudo Mágico = Ability/10, cap 100.
        let expertShieldGain = 0;
        if (charStats.theExpertActive && Math.random() < THE_EXPERT_SHIELD_CHANCE) {
          expertShieldGain = Math.min(THE_EXPERT_SHIELD_CAP, charStats.ability / THE_EXPERT_SHIELD_ABILITY_DIVISOR);
        }

        return { damage, isCrit, trueDamage, selfTrueDamage, coreStrengthSelfDamage, edgeLifeHeal, expertShieldGain };
      }

      // Jagged Rhythm (Adaga) + To Be Ninja (Espada) + Gaff Hack (buff de 1 uso
      // consumido aqui) — todas as fontes de "golpe extra" desse personagem, cada uma
      // rolada independente. Só dispara 1 golpe extra por fonte (sem encadear).
      const hits = [rollHit()];
      if (charStats.daggerExtraHitOnAttackChance && Math.random() < charStats.daggerExtraHitOnAttackChance) hits.push(rollHit());
      if (charStats.ninjaExtraHitChance && Math.random() < charStats.ninjaExtraHitChance) hits.push(rollHit());
      const gaffHackTriggered = char.castAttackBurstBuff;
      if (gaffHackTriggered) hits.push(rollHit());
      const isCrit = hits.some((h) => h.isCrit);
      const totalTrueDamage = hits.reduce((sum, h) => sum + h.trueDamage, 0);
      const totalSelfDamage = hits.reduce((sum, h) => sum + h.selfTrueDamage, 0);
      const totalCoreStrengthSelfDamage = hits.reduce((sum, h) => sum + h.coreStrengthSelfDamage, 0);
      const totalEdgeLifeHeal = hits.reduce((sum, h) => sum + h.edgeLifeHeal, 0);
      const totalExpertShieldGain = hits.reduce((sum, h) => sum + h.expertShieldGain, 0);

      // Charge the Stick: se um cast Elemental recente (com Cajado/Varinha) carregou o
      // próximo golpe, esse ataque soma o Dano Verdadeiro acumulado e consome o buff.
      const staffChargeDamage = char.staffChargeBuff > 0 ? char.staffChargeBuff : 0;
      // Dark Blade Plus (Adaga): cada golpe (incluindo golpes extras) dá +3 Mana.
      const darkBladeManaGain = charStats.darkBladePlusActive ? hits.length * DARK_BLADE_MANA_PER_HIT : 0;

      // Frantic Conjury: se um cast de Fogo/Energia ativou a chance, esse golpe também
      // conjura Conjure Fire de graça (mesma fórmula da magia) contra o monstro atual.
      let franticConjuryDamage = 0;
      if (char.franticConjuryBuff) {
        const conjureFireSpell = SPELLS_BY_ID.ConjureFire;
        const { avg: avgWeaponDamage } = computeDamageRoll(charStats);
        const rawConjureDamage = computeSpellEffect(conjureFireSpell, charStats, avgWeaponDamage);
        const armorAfterFlatForConjure = Math.max(0, currentMonster.armor - (charStats.armorPenFlat ?? 0));
        const effectiveArmorForConjure = Math.max(0, armorAfterFlatForConjure * (1 - (charStats.armorPenPercent ?? 0) / 100));
        franticConjuryDamage = Math.max(1, (rawConjureDamage - effectiveArmorForConjure / 2) / (1 + effectiveArmorForConjure / 100));
      }

      // Battle Mage (Luva): Dano Verdadeiro fixo (Magic/3, capado), todo golpe.
      const gloveBattleMageDamage = charStats.gloveBattleMageDamage ?? 0;

      // Shape of Water (Luva, capstone): gasta 3 de mana no golpe pra causar +5 de
      // Dano Verdadeiro — só se tiver mana suficiente (não é obrigatório).
      const shapeOfWaterActive = charStats.shapeOfWaterActive && char.currentMana >= SHAPE_OF_WATER_MANA_COST;
      const shapeOfWaterDamage = shapeOfWaterActive ? SHAPE_OF_WATER_TRUE_DAMAGE : 0;
      const shapeOfWaterManaCost = shapeOfWaterActive ? SHAPE_OF_WATER_MANA_COST : 0;

      const playerDamage = hits.reduce((sum, h) => sum + h.damage, 0) + totalTrueDamage + staffChargeDamage + franticConjuryDamage + gloveBattleMageDamage + shapeOfWaterDamage;
      const monsterHealth = Math.max(0, currentMonster.currentHealth - playerDamage);

      // Berserker (Arma Grande) soma seus degraus de Lifeleech em cima do lifestealPercent normal.
      const effectiveLifestealPercent = (charStats.lifestealPercent ?? 0) + berserkerSteps;
      const lifestealHeal = playerDamage * (effectiveLifestealPercent / 100) + totalEdgeLifeHeal;
      // Magic Blade (Arma Grande): recupera Mana baseado no dano causado (mesmo padrão
      // do antigo Manaleech, agora sob a flag magicBladeLifeManaActive).
      const manaLeechGain = charStats.magicBladeLifeManaActive ? playerDamage * (MAGIC_BLADE_MANALEECH_PCT / 100) : 0;
      // True Grip (Luva): cada golpe (incluindo golpes extras) tem uma CHANCE de
      // regenerar 3 de mana — não é garantido como antes, é uma rolagem por rank.
      let trueGripManaGain = 0;
      if (charStats.gloveManaOnHitChance > 0) {
        for (let i = 0; i < hits.length; i++) {
          if (Math.random() < charStats.gloveManaOnHitChance) trueGripManaGain += 3;
        }
      }

      let log = pushLog(
        state.log,
        `Você causou ${playerDamage.toFixed(1)} de dano em ${currentMonster.name}.${isCrit ? ' (crítico!)' : ''}${hits.length > 1 ? ' (ataque duplo!)' : ''}`,
      );
      if (totalTrueDamage > 0) {
        log = pushLog(log, `Dano verdadeiro: +${totalTrueDamage.toFixed(1)} (ignora armadura).`);
      }
      if (staffChargeDamage > 0) {
        log = pushLog(log, `Charge the Stick: +${staffChargeDamage.toFixed(1)} de dano verdadeiro.`);
      }
      if (franticConjuryDamage > 0) {
        log = pushLog(log, `Frantic Conjury: Conjure Fire de graça causou +${franticConjuryDamage.toFixed(1)}.`);
      }
      if (gloveBattleMageDamage > 0) {
        log = pushLog(log, `Battle Mage: +${gloveBattleMageDamage.toFixed(1)} de dano verdadeiro.`);
      }
      if (shapeOfWaterDamage > 0) {
        log = pushLog(log, `Shape of Water: +${shapeOfWaterDamage} de dano verdadeiro (-${shapeOfWaterManaCost} mana).`);
      }
      if (gaffHackTriggered) {
        log = pushLog(log, 'Gaff Hack: golpe extra!');
      }
      if (lifestealHeal > 0) {
        log = pushLog(log, `Lifesteal: +${lifestealHeal.toFixed(1)} de vida.`);
      }
      if (totalSelfDamage > 0) {
        log = pushLog(log, `Dark Blade: você recebeu ${totalSelfDamage.toFixed(1)} de dano verdadeiro.`);
      }
      if (totalCoreStrengthSelfDamage > 0) {
        log = pushLog(log, `Core Strength: você recebeu ${totalCoreStrengthSelfDamage.toFixed(1)} de dano verdadeiro.`);
      }
      if (totalExpertShieldGain > 0) {
        log = pushLog(log, `The Expert: +${totalExpertShieldGain.toFixed(1)} de escudo.`);
      }
      if (darkBladeManaGain > 0) {
        log = pushLog(log, `Dark Blade: +${darkBladeManaGain} de mana.`);
      }
      if (manaLeechGain > 0) {
        log = pushLog(log, `Magic Blade: +${manaLeechGain.toFixed(1)} de mana.`);
      }
      if (trueGripManaGain > 0) {
        log = pushLog(log, `True Grip: +${trueGripManaGain} de mana.`);
      }

      if (staffManaCost > 0) {
        log = pushLog(log, `Ataque com cajado consumiu ${staffManaCost} de mana.`);
      }

      // The Expert (Espada): Escudo Mágico ganho nesse ataque (dobrado/com cap maior
      // se Onyx Screen estiver ativo).
      const shieldPointsAfterExpert = totalExpertShieldGain > 0
        ? addShieldGain(char.shieldPoints, totalExpertShieldGain, charStats.onyxScreenActive)
        : (char.shieldPoints ?? 0);

      // Dano Verdadeiro que você recebe de volta (Dark Blade Plus + Core Strength) —
      // clampado no final pra nunca deixar sua vida chegar a 0 ou negativa.
      const totalSelfInflictedDamage = totalSelfDamage + totalCoreStrengthSelfDamage;

      // Buffs de 1 uso do golpe são consumidos aqui, independente do resultado (matou
      // o monstro ou não). Mana: custo do cajado/Shape of Water sai, leech/regen/Dark
      // Blade entram.
      const charWithBuffsConsumed = {
        ...char,
        staffChargeBuff: 0,
        franticConjuryBuff: false,
        castAttackBurstBuff: false,
        shieldPoints: shieldPointsAfterExpert,
        currentMana: Math.min(
          charStats.mana,
          char.currentMana - staffManaCost - shapeOfWaterManaCost + manaLeechGain + trueGripManaGain + darkBladeManaGain,
        ),
      };

      if (monsterHealth <= 0) {
        return {
          ...state,
          ...defeatMonster(charWithBuffsConsumed, currentMonster, log, { lifestealHeal, selfDamage: totalSelfInflictedDamage }),
        };
      }

      const healthAfterLifesteal = Math.max(
        1,
        Math.min(charStats.health, char.currentHealth + lifestealHeal) - totalSelfInflictedDamage,
      );

      return {
        ...state,
        character: { ...charWithBuffsConsumed, currentHealth: healthAfterLifesteal },
        monster: { ...currentMonster, currentHealth: monsterHealth },
        log,
      };
    }

    case 'MONSTER_ATTACK': {
      const { character: char, monster: currentMonster } = state;
      if (!char || !currentMonster || char.currentHealth <= 0) return state;
      if (state.combatPauseUntil && Date.now() < state.combatPauseUntil) return state;

      const charStats = computeFinalStats(char);
      // Duas mitigações reais aplicadas em sequência (apogean.eu/lists/formulae):
      // Defense primeiro — (DanoDoAtacante - Defesa) / NúmeroDeAtacantes (sempre 1
      // atacante aqui) — depois Armor — (Resultado - Armadura/2) / (1 + Armadura/100).
      const afterDefense = Math.max(0, currentMonster.damage - charStats.defense);
      let monsterDamage = Math.max(1, (afterDefense - charStats.armor / 2) / (1 + charStats.armor / 100));
      // Onyx Screen (Orbe): dobra o dano NORMAL recebido — risco pesado, mas dobra
      // também todo ganho de Escudo Mágico (ver addShieldGain).
      if (charStats.onyxScreenActive) monsterDamage *= 2;

      let workingChar = { ...char };
      let workingMonster = currentMonster;
      let combatPauseUntil = state.combatPauseUntil;
      let log = state.log;

      // Bloqueio: Arcane Trickster (Luva, buff de 1 cast) OU escudo equipado (chance
      // base homebrew — nenhuma fonte real documenta o valor, só que talentos
      // "melhoram" um bloqueio que já existiria). Bloqueio anula o golpe inteiro.
      const castBlocked = workingChar.castBlockBuff;
      const shieldBlocked = !castBlocked && charStats.hasShieldEquipped && Math.random() < (charStats.blockChance ?? 0);
      const blocked = castBlocked || shieldBlocked;
      if (castBlocked) workingChar = { ...workingChar, castBlockBuff: false };

      if (blocked) {
        log = pushLog(log, `Você bloqueou o ataque de ${currentMonster.name}!${castBlocked ? ' (Arcane Trickster)' : ''}`);
        monsterDamage = 0;
      }

      // Diamond Skin (Orbe): escudo acumulado por conjurar magia de Energia/Physical/
      // Arrow absorve esse dano ANTES da vida (só relevante se não bloqueou — bloqueio
      // já zerou tudo). Seer Apparel (Luva): "todo dano no Escudo Mágico é cortado pela
      // metade" — cada ponto de escudo absorve o DOBRO de dano (o escudo rende mais).
      const shieldEfficiency = charStats.seerApparelActive ? 2 : 1;
      const shieldBefore = workingChar.shieldPoints ?? 0;
      const absorbed = Math.min(shieldBefore * shieldEfficiency, monsterDamage);
      const damageToHealth = monsterDamage - absorbed;
      const shieldAfter = shieldBefore - absorbed / shieldEfficiency;

      if (!blocked) {
        log = pushLog(
          log,
          `${currentMonster.name} causou ${monsterDamage.toFixed(1)} de dano em você.${absorbed > 0 ? ` Escudo absorveu ${absorbed.toFixed(1)}.` : ''}`,
        );
      }
      workingChar = { ...workingChar, shieldPoints: shieldAfter };

      // Stubborn Will (Armadura Pesada): ao tomar dano (sem bloquear), chance de
      // ganhar Escudo Mágico.
      if (!blocked && monsterDamage > 0 && charStats.stubbornWillChance > 0 && Math.random() < charStats.stubbornWillChance) {
        const newShield = addShieldGain(workingChar.shieldPoints, STUBBORN_WILL_SHIELD_GAIN, charStats.onyxScreenActive);
        workingChar = { ...workingChar, shieldPoints: newShield };
        log = pushLog(log, `Stubborn Will: escudo agora em ${newShield.toFixed(1)}.`);
      }

      // Innervated Mana (Escudo): dano que realmente chegou na vida vira Mana (2:1).
      if (charStats.innervatedManaActive && damageToHealth > 0) {
        const manaGain = damageToHealth / INNERVATED_MANA_DAMAGE_TO_MANA_DIVISOR;
        workingChar = { ...workingChar, currentMana: Math.min(charStats.mana, workingChar.currentMana + manaGain) };
        log = pushLog(log, `Innervated Mana: +${manaGain.toFixed(1)} de mana.`);
      }

      // Unstable Aegis (Orbe): toda vez que o escudo absorve dano, estoura um
      // "Unstable Berserk" homebrew (dano verdadeiro baseado em Magic) no monstro —
      // não é uma das 34 magias documentadas, valor aproximado.
      if (absorbed > 0 && charStats.unstableAegisActive) {
        const burst = charStats.magic / UNSTABLE_AEGIS_MAGIC_DIVISOR;
        log = pushLog(log, `Unstable Aegis: estourou ${burst.toFixed(1)} de dano verdadeiro em ${workingMonster.name}.`);
        const monsterHealthAfterBurst = Math.max(0, workingMonster.currentHealth - burst);
        if (monsterHealthAfterBurst <= 0) {
          const result = defeatMonster(workingChar, workingMonster, log);
          workingChar = result.character;
          workingMonster = result.monster;
          log = result.log;
          combatPauseUntil = result.combatPauseUntil;
        } else {
          workingMonster = { ...workingMonster, currentHealth: monsterHealthAfterBurst };
        }
      }

      // Repelling Shell (Orbe): mesmo gatilho de absorção de Escudo, outro estouro
      // homebrew independente ("Repelling Force"), com divisor de Magic diferente do
      // Unstable Aegis pra distinguir os dois procs.
      if (workingMonster && absorbed > 0 && charStats.orbShieldProcActive && Math.random() < ORB_SHIELD_PROC_CHANCE) {
        const burst = Math.floor(charStats.magic / REPELLING_SHELL_MAGIC_DIVISOR);
        log = pushLog(log, `Repelling Shell: estourou ${burst} de dano verdadeiro em ${workingMonster.name}.`);
        const monsterHealthAfterBurst = Math.max(0, workingMonster.currentHealth - burst);
        if (monsterHealthAfterBurst <= 0) {
          const result = defeatMonster(workingChar, workingMonster, log);
          workingChar = result.character;
          workingMonster = result.monster;
          log = result.log;
          combatPauseUntil = result.combatPauseUntil;
        } else {
          workingMonster = { ...workingMonster, currentHealth: monsterHealthAfterBurst };
        }
      }

      const newStats = computeFinalStats(workingChar);
      const newHealthRaw = Math.max(0, workingChar.currentHealth - damageToHealth);

      let autoCombat = state.autoCombat;
      let deaths = workingChar.deaths;
      let newHealth = newHealthRaw;
      let inventory = workingChar.inventory;
      let currentMana = workingChar.currentMana;
      if (newHealthRaw <= 0) {
        deaths += 1;
        autoCombat = false;
        // Ao morrer, a vida volta cheia (respawn instantâneo) — sem isso o personagem
        // ficava travado com 0 de vida pra sempre, já que o regen não age em vida 0.
        newHealth = newStats.health;
        log = pushLog(log, 'Você foi derrotado! Reviveu com a vida cheia. Combate automático interrompido.');
      } else {
        const potionResult = autoUsePotions({ ...workingChar, currentHealth: newHealthRaw }, newStats, log);
        inventory = potionResult.inventory;
        newHealth = potionResult.currentHealth;
        currentMana = potionResult.currentMana;
        log = potionResult.log;
      }

      return {
        ...state,
        character: { ...workingChar, currentHealth: newHealth, currentMana, deaths, autoCombat, inventory },
        monster: workingMonster,
        log,
        autoCombat,
        combatPauseUntil,
      };
    }

    case 'REGEN_TICK': {
      const char = state.character;
      if (!char || char.currentHealth <= 0) return state;
      const s = computeFinalStats(char);
      // Fórmula real: a cada 10s, restaura METADE do stat de HP/MP Regen.
      let currentHealth = Math.min(s.health, char.currentHealth + s.hpRegen * 0.5);
      const currentMana = Math.min(s.mana, char.currentMana + s.mpRegen * 0.5);
      let inventory = char.inventory;
      let log = state.log;

      if (currentHealth < s.health * 0.8) {
        const foodIdx = inventory.findIndex(
          (i) => i.type === ITEM_TYPES.CONSUMABLE && i.stats?.health && i.quantity > 0,
        );
        if (foodIdx >= 0) {
          const food = inventory[foodIdx];
          currentHealth = Math.min(s.health, currentHealth + food.stats.health);
          inventory = inventory
            .map((i, idx) => (idx === foodIdx ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0);
          log = pushLog(log, `Você comeu ${food.name} e recuperou ${food.stats.health} de vida.`);
        }
      }

      let satiety = tickSatiety(char.satiety, REGEN_TICK_MS);

      // Comer automático (opção ligada no painel do Personagem): se a saciedade zerou
      // e sobrou comida na mochila (normalmente não sobra, já que agora se come na
      // hora que a comida chega), come sozinho como último recurso.
      if (char.autoEat && satiety.remainingMs <= 0) {
        const foodIdx = inventory.findIndex((i) => FOOD_CATEGORIES.has(i.category) && i.quantity > 0);
        if (foodIdx >= 0) {
          const food = inventory[foodIdx];
          satiety = eatFood(satiety, food.category);
          satiety.foodName = food.name;
          inventory = inventory
            .map((i, idx) => (idx === foodIdx ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0);
          log = pushLog(log, `Você comeu ${food.name} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`);
        }
      }

      // Rede de segurança da poção automática: cobre qualquer queda de vida/mana que
      // não passou pelos outros pontos de checagem (ex: dano verdadeiro que você
      // recebe de volta do Dark Blade).
      const potionResult = autoUsePotions({ ...char, currentHealth, currentMana, inventory }, s, log);
      inventory = potionResult.inventory;
      currentHealth = potionResult.currentHealth;
      const currentManaAfterPotion = potionResult.currentMana;
      log = potionResult.log;

      if (
        currentHealth === char.currentHealth &&
        currentManaAfterPotion === char.currentMana &&
        inventory === char.inventory &&
        satiety === char.satiety
      ) {
        return state;
      }
      return { ...state, character: { ...char, currentHealth, currentMana: currentManaAfterPotion, inventory, satiety }, log };
    }

    case 'CONSUME_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const s = computeFinalStats(char);
      let currentHealth = char.currentHealth;
      let currentMana = char.currentMana;
      let satiety = char.satiety;
      let log = state.log;

      if (item.stats?.health || item.stats?.mana) {
        if (item.stats?.health) {
          currentHealth = Math.min(s.health, currentHealth + item.stats.health);
          log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.health} de vida.`);
        }
        if (item.stats?.mana) {
          currentMana = Math.min(s.mana, currentMana + item.stats.mana);
          log = pushLog(log, `Você usou ${item.name} e recuperou ${item.stats.mana} de mana.`);
        }
      } else if (FOOD_CATEGORIES.has(item.category)) {
        const wasSated = (char.satiety?.remainingMs ?? 0) > 0;
        satiety = eatFood(char.satiety, item.category);
        satiety.foodName = wasSated ? char.satiety.foodName : item.name;
        const totalMin = Math.round(satiety.remainingMs / 60000);
        log = pushLog(
          log,
          wasSated
            ? `Você comeu ${item.name}. Saciedade +${totalMin - Math.round(char.satiety.remainingMs / 60000)}min (bônus continua sendo de ${satiety.foodName}).`
            : `Você comeu ${item.name}. Saciado por ${totalMin}min.`,
        );
      }

      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return { ...state, character: { ...char, currentHealth, currentMana, satiety, inventory }, log };
    }

    case 'SELL_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra vender itens em combate — pare a caçada primeiro.') };
      }
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const sellQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const total = (item.sellPrice ?? 0) * sellQty;
      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - sellQty } : i))
        .filter((i) => i.quantity > 0);

      return {
        ...state,
        character: { ...char, gold: char.gold + total, totalGoldEarned: char.totalGoldEarned + total, inventory },
        log: pushLog(state.log, `Você vendeu ${sellQty}x ${item.name} por ${total} gold.`),
      };
    }

    case 'BUY_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra comprar itens em combate — pare a caçada primeiro.') };
      }
      const merchant = MERCHANTS_BY_NAME[action.merchantName];
      const offer = merchant?.sells.find((s) => s.name === action.itemName);
      if (!offer) {
        return { ...state, log: pushLog(state.log, `${merchant?.name ?? action.merchantName} não vende ${action.itemName}.`) };
      }
      if (char.gold < offer.price) {
        return {
          ...state,
          log: pushLog(state.log, `Gold insuficiente: ${action.itemName} custa ${offer.price}g, você tem ${char.gold}g.`),
        };
      }

      const def = getShopItemDefinition(action.itemName);
      let log = pushLog(state.log, `Você comprou ${action.itemName} de ${merchant.name} por ${offer.price} gold.`);
      let satiety = char.satiety;

      // Comida comprada com comer automático ligado é comida na hora — não depende de
      // espaço na mochila (nunca chega a ficar guardada).
      if (char.autoEat && FOOD_CATEGORIES.has(def.category)) {
        satiety = eatFood(satiety, def.category);
        satiety.foodName = satiety.foodName ?? action.itemName;
        log = pushLog(log, `Você comeu ${action.itemName} automaticamente. Saciado por ${Math.round(satiety.remainingMs / 60000)}min.`);
        return { ...state, character: { ...char, gold: char.gold - offer.price, satiety }, log };
      }

      // Mesma correção do loot de monstro: o nome anunciado pela loja às vezes é a
      // grafia antiga (ex: alias em ITEM_NAME_ALIASES) — resolve pro nome canônico do
      // catálogo antes de criar o item, senão ele nasce com nome errado igual o bug do
      // loot que já foi corrigido.
      const resolvedName = resolveRealItemName(action.itemName);
      const id = `${slugify(resolvedName)}-${def.rarity}`;
      const addedWeight = def.weight ?? 1;
      const currentWeight = inventoryWeight(char.inventory);
      const stats = computeFinalStats(char);
      if (currentWeight + addedWeight > stats.capacity) {
        return { ...state, log: pushLog(state.log, `Mochila cheia! Não coube ${action.itemName}.`) };
      }

      const idx = char.inventory.findIndex((i) => i.id === id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
        : [...char.inventory, { id, name: resolvedName, quantity: 1, ...def }];

      return {
        ...state,
        character: { ...char, gold: char.gold - offer.price, inventory, satiety },
        log,
      };
    }

    case 'SELL_TO_MERCHANT': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra vender itens em combate — pare a caçada primeiro.') };
      }
      const merchant = MERCHANTS_BY_NAME[action.merchantName];
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;
      const offer = merchant?.buys.find((b) => b.name === item.name);
      const price = offer?.price ?? item.sellPrice ?? 0;

      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      return {
        ...state,
        character: { ...char, gold: char.gold + price, totalGoldEarned: char.totalGoldEarned + price, inventory },
        log: pushLog(state.log, `Você vendeu ${item.name} para ${action.merchantName} por ${price} gold.`),
      };
    }

    case 'DISCARD_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item) return state;

      const inventory = char.inventory.filter((i) => i.id !== action.itemId);
      return {
        ...state,
        character: { ...char, inventory },
        log: pushLog(state.log, `Você descartou ${item.name}.`),
      };
    }

    case 'ADD_TO_BLACKLIST': {
      const char = state.character;
      const name = action.itemName?.trim();
      if (!char || !name) return state;
      // minRarity null = bloqueia o item em qualquer raridade; com minRarity, só
      // bloqueia abaixo dela (ex: Torch com minRarity "epic" deixa passar épico+).
      const minRarity = action.minRarity ?? null;
      const itemBlacklist = (char.itemBlacklist ?? []).filter((e) => e.name !== name);
      const message = minRarity
        ? `${name} adicionado à blacklist — só será pego a partir de ${RARITY_LABELS[minRarity] ?? minRarity}.`
        : `${name} adicionado à blacklist — não será mais pego.`;
      return {
        ...state,
        character: { ...char, itemBlacklist: [...itemBlacklist, { name, minRarity }] },
        log: pushLog(state.log, message),
      };
    }

    case 'REMOVE_FROM_BLACKLIST': {
      const char = state.character;
      if (!char) return state;
      const itemBlacklist = (char.itemBlacklist ?? []).filter((e) => e.name !== action.itemName);
      return {
        ...state,
        character: { ...char, itemBlacklist },
        log: pushLog(state.log, `${action.itemName} removido da blacklist.`),
      };
    }

    case 'DEPOSIT_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra mexer no banco em combate — pare a caçada primeiro.') };
      }
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const moveQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - moveQty } : i))
        .filter((i) => i.quantity > 0);

      const idx = char.bank.findIndex((i) => i.id === item.id);
      const bank = idx >= 0
        ? char.bank.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + moveQty } : i))
        : [...char.bank, { ...item, quantity: moveQty }];

      return {
        ...state,
        character: { ...char, inventory, bank },
        log: pushLog(state.log, `Você guardou ${moveQty}x ${item.name} no banco.`),
      };
    }

    case 'WITHDRAW_ITEM': {
      const char = state.character;
      if (!char) return state;
      if (state.autoCombat) {
        return { ...state, log: pushLog(state.log, 'Não dá pra mexer no banco em combate — pare a caçada primeiro.') };
      }
      const item = char.bank.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;

      const moveQty = action.all ? item.quantity : Math.min(1, item.quantity);
      const addedWeight = (item.weight ?? 1) * moveQty;
      const currentWeight = inventoryWeight(char.inventory);
      const stats = computeFinalStats(char);
      if (currentWeight + addedWeight > stats.capacity) {
        return { ...state, log: pushLog(state.log, `Mochila cheia! Não coube ${item.name}.`) };
      }

      const bank = char.bank
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - moveQty } : i))
        .filter((i) => i.quantity > 0);

      const idx = char.inventory.findIndex((i) => i.id === item.id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + moveQty } : i))
        : [...char.inventory, { ...item, quantity: moveQty }];

      return {
        ...state,
        character: { ...char, inventory, bank },
        log: pushLog(state.log, `Você retirou ${moveQty}x ${item.name} do banco.`),
      };
    }

    // As 4 ações a seguir são o lado LOCAL do comércio entre jogadores — sempre
    // disparadas DEPOIS que a operação no Firestore compartilhado (services/firebase.js)
    // já deu certo. Cada jogador só mexe no PRÓPRIO gold/banco, nunca no de outra conta.
    case 'MARKET_LIST_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.bank.find((i) => i.id === action.itemId);
      if (!item || item.quantity <= 0) return state;
      const bank = char.bank
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      return {
        ...state,
        character: { ...char, bank },
        log: pushLog(state.log, `Você anunciou ${item.name} no mercado.`),
      };
    }

    case 'MARKET_DEDUCT_GOLD': {
      const char = state.character;
      if (!char) return state;
      return {
        ...state,
        character: { ...char, gold: char.gold - action.amount },
        log: pushLog(state.log, action.message ?? `${action.amount}g descontado.`),
      };
    }

    case 'MARKET_ADD_GOLD': {
      const char = state.character;
      if (!char) return state;
      return {
        ...state,
        character: { ...char, gold: char.gold + action.amount, totalGoldEarned: char.totalGoldEarned + action.amount },
        log: pushLog(state.log, action.message ?? `+${action.amount}g do mercado.`),
      };
    }

    case 'MARKET_ADD_BANK_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = action.item;
      const idx = char.bank.findIndex((i) => i.id === item.id);
      const bank = idx >= 0
        ? char.bank.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + item.quantity } : i))
        : [...char.bank, item];
      return {
        ...state,
        character: { ...char, bank },
        log: pushLog(state.log, action.message ?? `${item.name} chegou no seu banco.`),
      };
    }

    case 'EQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.inventory.find((i) => i.id === action.itemId);
      if (!item || !item.slot) return state;

      // Armas podem ir na mão principal OU secundária (dual-wield real do jogo) — só
      // itens de slot "weapon" aceitam esse destino alternativo; os demais slots são fixos.
      const slot = item.slot === 'weapon' && action.targetSlot === 'offhand' ? 'offhand' : item.slot;
      const previouslyEquipped = char.equipment[slot];

      // Tamanho das mãos: arma + mão secundária não podem somar mais que 10 (equipSize
      // real de cada item, "MÃOS: X/10" na tela do personagem).
      if (slot === 'weapon' || slot === 'offhand') {
        const otherSlot = slot === 'weapon' ? 'offhand' : 'weapon';
        const otherSize = char.equipment[otherSlot]?.equipSize ?? 0;
        if ((item.equipSize ?? 0) + otherSize > HAND_CAPACITY) {
          return {
            ...state,
            log: pushLog(state.log, `${item.name} não cabe nas mãos (tamanho ${item.equipSize ?? 0} + ${otherSize} > ${HAND_CAPACITY}).`),
          };
        }
      }

      let inventory = char.inventory
        .map((i) => (i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);

      if (previouslyEquipped) {
        const idx = inventory.findIndex((i) => i.id === previouslyEquipped.id);
        inventory = idx >= 0
          ? inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
          : [...inventory, { ...previouslyEquipped, quantity: 1 }];
      }

      const equipment = { ...char.equipment, [slot]: { ...item, quantity: 1 } };
      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);

      return { ...state, character: newChar, log: pushLog(state.log, `Você equipou ${item.name}.`) };
    }

    case 'UNEQUIP_ITEM': {
      const char = state.character;
      if (!char) return state;
      const item = char.equipment[action.slot];
      if (!item) return state;

      const idx = char.inventory.findIndex((i) => i.id === item.id);
      const inventory = idx >= 0
        ? char.inventory.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + 1 } : i))
        : [...char.inventory, { ...item, quantity: 1 }];

      const equipment = { ...char.equipment, [action.slot]: null };
      const newChar = { ...char, inventory, equipment };
      const s = computeFinalStats(newChar);
      newChar.currentHealth = Math.min(s.health, newChar.currentHealth);
      newChar.currentMana = Math.min(s.mana, newChar.currentMana);

      return { ...state, character: newChar, log: pushLog(state.log, `Você desequipou ${item.name}.`) };
    }

    case 'ALLOCATE_STAT': {
      const char = state.character;
      if (!char || !canAllocatePoint(char.levelBatches, action.stat)) return state;
      return { ...state, character: { ...char, levelBatches: allocatePoint(char.levelBatches, action.stat) } };
    }

    case 'RESET_ATTRIBUTES': {
      const char = state.character;
      if (!char || char.gold < RESPEC_COST || char.levelBatches.length === 0) return state;
      const levelBatches = char.levelBatches.map(() => ({ remaining: POINTS_PER_LEVEL, spent: {} }));
      return {
        ...state,
        character: { ...char, gold: char.gold - RESPEC_COST, levelBatches },
        log: pushLog(state.log, `Atributos resetados por ${RESPEC_COST} gold.`),
      };
    }

    case 'RESET_TALENTS': {
      const char = state.character;
      if (!char) return state;
      const cost = talentResetCost(char.talentResetCount);
      const hasPoints = Object.values(char.talentPoints ?? {}).some((p) => p > 0);
      if (char.gold < cost || !hasPoints) return state;
      return {
        ...state,
        character: {
          ...char,
          gold: char.gold - cost,
          talentPoints: {},
          talentResetCount: (char.talentResetCount ?? 0) + 1,
        },
        log: pushLog(state.log, `Talentos resetados por ${cost} gold.`),
      };
    }

    case 'INVEST_TALENT': {
      const char = state.character;
      if (!char) return state;
      const available = talentPointsForLevel(char.level) - spentTalentPoints(char.talentPoints);
      if (available <= 0 || !canInvestTalent(char.talentPoints, action.talentId)) return state;
      const talentPoints = {
        ...char.talentPoints,
        [action.talentId]: (char.talentPoints[action.talentId] ?? 0) + 1,
      };
      return { ...state, character: { ...char, talentPoints } };
    }

    case 'CLAIM_QUEST': {
      const char = state.character;
      if (!char) return state;
      const quest = QUESTS_BY_ID[action.questId];
      if (!quest || isQuestClaimed(char, quest) || !isQuestComplete(char, quest)) return state;

      const log0 = pushLog(
        state.log,
        `Quest concluída: ${quest.description} — +${quest.rewardGold} gold, +${quest.rewardXp} XP.`,
      );
      const { xp, level, levelBatches, log, leveledUp } = applyXpGain(char, quest.rewardXp, log0);

      const updatedChar = {
        ...char,
        xp,
        level,
        levelBatches,
        gold: char.gold + quest.rewardGold,
        totalGoldEarned: char.totalGoldEarned + quest.rewardGold,
        totalXpEarned: char.totalXpEarned + quest.rewardXp,
        claimedQuests: [...char.claimedQuests, quest.id],
      };
      const newStats = computeFinalStats(updatedChar);
      // Subir de nível enche vida e mana por completo — igual ao jogo real.
      updatedChar.currentHealth = leveledUp ? newStats.health : Math.min(newStats.health, char.currentHealth);
      updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);

      return { ...state, character: updatedChar, log };
    }

    case 'CHANGE_ZONE': {
      if (!state.character) return state;
      return {
        ...state,
        character: { ...state.character, zoneId: action.zoneId },
        monster: pickMonster(action.zoneId),
      };
    }

    // Progresso offline: calculado FORA do reducer (precisa de Date.now() e da zona)
    // e despachado já pronto — xpGain/goldGain só chegam aqui depois de aplicar o
    // teto de 8h. Nunca dá item, só XP e gold (peso/mochila cheia não fariam sentido
    // pra algo que não aconteceu de verdade na tela).
    case 'APPLY_OFFLINE_PROGRESS': {
      const char = state.character;
      if (!char || (action.xpGain <= 0 && action.goldGain <= 0)) return state;
      const hoursLabel = action.hours >= 1 ? `${action.hours.toFixed(1)}h` : `${Math.round(action.hours * 60)}min`;
      const log0 = pushLog(
        state.log,
        `Enquanto você esteve fora (${hoursLabel} caçando em ${action.zoneName}): +${action.xpGain} XP, +${action.goldGain} gold.`,
      );
      const { xp, level, levelBatches, log, leveledUp } = applyXpGain(char, action.xpGain, log0);
      const updatedChar = {
        ...char,
        xp,
        level,
        levelBatches,
        gold: char.gold + action.goldGain,
        totalGoldEarned: char.totalGoldEarned + action.goldGain,
        totalXpEarned: char.totalXpEarned + action.xpGain,
      };
      const newStats = computeFinalStats(updatedChar);
      updatedChar.currentHealth = leveledUp ? newStats.health : Math.min(newStats.health, char.currentHealth);
      updatedChar.currentMana = leveledUp ? newStats.mana : Math.min(newStats.mana, char.currentMana);
      return { ...state, character: updatedChar, log };
    }

    default:
      return state;
  }
}

// Toda vez que o reducer troca o personagem por um objeto novo, marca "updatedAt"
// agora. É isso que permite decidir, ao carregar em outro dispositivo, se o save
// local ou o da nuvem é o mais recente (sem isso, dar refresh no MESMO dispositivo
// podia sobrescrever com uma versão da nuvem levemente atrasada).
function reducerWithTimestamp(state, action) {
  const next = reducer(state, action);
  if (next.character && next.character !== state.character) {
    return { ...next, character: { ...next.character, updatedAt: Date.now() } };
  }
  return next;
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducerWithTimestamp, undefined, init);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [syncError, setSyncError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [offlineReport, setOfflineReport] = useState(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const offlineChecked = useRef(false);

  useEffect(() => {
    if (state.character) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
    }
  }, [state.character]);

  // Só roda uma vez, com o personagem exatamente como veio do localStorage ao abrir —
  // "estava caçando quando fechou" é o único caso que gera recompensa.
  useEffect(() => {
    if (offlineChecked.current) return;
    offlineChecked.current = true;
    const char = state.character;
    if (!char || !char.autoCombat || char.currentHealth <= 0) return;

    const elapsedMs = Math.min(Date.now() - (char.updatedAt || Date.now()), OFFLINE_CAP_MS);
    if (elapsedMs < OFFLINE_MIN_MS) return;

    const zone = ZONES.find((z) => z.id === char.zoneId) ?? ZONES[0];
    const hours = elapsedMs / 3600000;
    const xpGain = Math.round(zone.xpPerHour * hours);
    const goldGain = Math.round(zone.goldPerHour * hours);
    if (xpGain <= 0 && goldGain <= 0) return;

    dispatch({ type: 'APPLY_OFFLINE_PROGRESS', xpGain, goldGain, hours, zoneName: zone.name });
    setOfflineReport({ hours, xpGain, goldGain, zoneName: zone.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOfflineReport = useCallback(() => setOfflineReport(null), []);

  // Login com Google dá o MESMO UID em qualquer dispositivo — é essa a chave usada
  // no Firestore, então não precisa de código nenhum pra continuar no celular.
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Ao logar: busca o personagem salvo na nuvem sob esse UID. Se for mais recente
  // que o local (jogou por outro dispositivo depois), usa a versão da nuvem.
  //
  // "initialSyncDone" existe pra corrigir uma corrida séria: sem ele, o efeito de
  // SALVAR (logo abaixo) podia disparar antes dessa busca terminar — e se a busca
  // demorasse mais que o debounce de salvar, o personagem VELHO deste aparelho subia
  // pra nuvem e sobrescrevia um progresso mais avançado feito em outro aparelho
  // (exatamente o que te fez "voltar" de nível). Agora salvar só é permitido depois
  // que essa comparação inicial terminar.
  useEffect(() => {
    if (!user) return;
    setInitialSyncDone(false);
    let cancelled = false;
    (async () => {
      const remote = await loadGameState(user.uid).catch(() => null);
      if (cancelled) return;
      if (remote && (remote.updatedAt ?? 0) > (state.character?.updatedAt ?? 0)) {
        dispatch({ type: 'LOAD_REMOTE_CHARACTER', character: remote });
      }
      setInitialSyncDone(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Salva na nuvem (debounced) toda vez que o personagem muda, sob o UID da conta
  // Google logada — é isso que faz o outro dispositivo puxar o progresso depois.
  // Só roda depois do initialSyncDone (ver comentário acima).
  useEffect(() => {
    if (!user || !state.character || !initialSyncDone) return;
    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      saveGameState(user.uid, state.character)
        .then(() => {
          setSyncStatus('synced');
          setSyncError(null);
        })
        .catch((err) => {
          console.error('Falha ao sincronizar personagem:', err);
          setSyncStatus('error');
          setSyncError(err?.code || err?.message || 'Erro desconhecido.');
        });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [user, state.character, initialSyncDone]);

  const login = useCallback(() => {
    setAuthError(null);
    return loginWithGoogle().catch((err) => setAuthError(err?.code || err?.message || 'Erro desconhecido no login.'));
  }, []);
  const signOutUser = useCallback(() => logout().catch(() => {}), []);

  const hasCharacter = !!state.character;
  const isDead = hasCharacter && state.character.currentHealth <= 0;
  const attackSpeed = useMemo(
    () => (state.character ? computeFinalStats(state.character).attackSpeed : null),
    [state.character],
  );

  // Dois relógios independentes: o jogador ataca no ritmo da SUA Attack Speed, o
  // monstro ataca no ritmo dele (base real, já que não temos Attack Speed real por
  // monstro na fonte de dados) — attack speed dobrada = 2 hits seus pra cada 1 dele,
  // de verdade, não só "combate mais rápido". Só recria os intervalos quando algo que
  // muda o RITMO muda de verdade (ligar/desligar, attack speed, morte), nunca a cada
  // tick — isso evita a corrida que existia quando os dois lados dependiam do mesmo timer.
  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    // Fórmula real: Intervalo = 2s / (AttackSpeed / 10).
    const interval = TURN_MS / ((attackSpeed || 10) / 10);
    const id = setInterval(() => dispatch({ type: 'PLAYER_ATTACK' }), interval);
    return () => clearInterval(id);
  }, [state.autoCombat, attackSpeed, isDead, hasCharacter]);

  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    // Sem dado real de Attack Speed por monstro, usamos a base neutra do jogo
    // (AttackSpeed 10 → intervalo de 2s) pra todos os monstros.
    const id = setInterval(() => dispatch({ type: 'MONSTER_ATTACK' }), TURN_MS);
    return () => clearInterval(id);
  }, [state.autoCombat, isDead, hasCharacter]);

  useEffect(() => {
    if (!hasCharacter || isDead) return;
    const id = setInterval(() => dispatch({ type: 'REGEN_TICK' }), REGEN_TICK_MS);
    return () => clearInterval(id);
  }, [hasCharacter, isDead]);

  // Relógio próprio pra tentar conjurar as magias equipadas — roda mais rápido que o
  // cooldown de qualquer magia (a mais curta é 1.5s) só pra não deixar o cast atrasar
  // depois que o cooldown já liberou. O reducer já ignora se autoCastSpells tá desligado.
  useEffect(() => {
    if (!state.autoCombat || !hasCharacter || isDead) return;
    const id = setInterval(() => dispatch({ type: 'SPELL_CAST' }), 500);
    return () => clearInterval(id);
  }, [state.autoCombat, hasCharacter, isDead]);

  const stats = useMemo(
    () => (state.character ? computeFinalStats(state.character) : null),
    [state.character],
  );
  const character = state.character ? { ...state.character, stats } : null;
  // Refs "espelho" só pra funções assíncronas do leilão conseguirem ler o personagem
  // e o usuário mais atuais sem precisar recriar a função a cada render.
  const characterRef = useRef(character);
  characterRef.current = character;
  const userRef = useRef(user);
  userRef.current = user;

  const weight = useMemo(
    () => (state.character ? state.character.inventory.reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0) : 0),
    [state.character],
  );

  const createNewCharacter = useCallback((name) => dispatch({ type: 'CREATE_CHARACTER', name }), []);
  const chooseVocation = useCallback((vocation) => dispatch({ type: 'CHOOSE_VOCATION', vocation }), []);
  const resetCharacter = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET' });
  }, []);
  const setAutoCombat = useCallback((valueOrFn) => dispatch({ type: 'SET_AUTO_COMBAT', valueOrFn }), []);
  const setAutoEat = useCallback((enabled) => dispatch({ type: 'SET_AUTO_EAT', enabled }), []);
  const setAutoPotion = useCallback((settings) => dispatch({ type: 'SET_AUTO_POTION', settings }), []);
  const consumeItem = useCallback((itemId) => dispatch({ type: 'CONSUME_ITEM', itemId }), []);
  const sellItem = useCallback((itemId, all) => dispatch({ type: 'SELL_ITEM', itemId, all }), []);
  const discardItem = useCallback((itemId) => dispatch({ type: 'DISCARD_ITEM', itemId }), []);
  const depositItem = useCallback((itemId, all) => dispatch({ type: 'DEPOSIT_ITEM', itemId, all }), []);
  const withdrawItem = useCallback((itemId, all) => dispatch({ type: 'WITHDRAW_ITEM', itemId, all }), []);
  const addToBlacklist = useCallback(
    (itemName, minRarity) => dispatch({ type: 'ADD_TO_BLACKLIST', itemName, minRarity }),
    [],
  );
  const removeFromBlacklist = useCallback((itemName) => dispatch({ type: 'REMOVE_FROM_BLACKLIST', itemName }), []);
  const equipItem = useCallback((itemId, targetSlot) => dispatch({ type: 'EQUIP_ITEM', itemId, targetSlot }), []);
  const unequipItem = useCallback((slot) => dispatch({ type: 'UNEQUIP_ITEM', slot }), []);
  const allocateStat = useCallback((stat) => dispatch({ type: 'ALLOCATE_STAT', stat }), []);
  const resetAttributes = useCallback(() => dispatch({ type: 'RESET_ATTRIBUTES' }), []);
  const resetTalents = useCallback(() => dispatch({ type: 'RESET_TALENTS' }), []);
  const investTalent = useCallback((talentId) => dispatch({ type: 'INVEST_TALENT', talentId }), []);
  const changeZone = useCallback((zoneId) => dispatch({ type: 'CHANGE_ZONE', zoneId }), []);
  const claimQuest = useCallback((questId) => dispatch({ type: 'CLAIM_QUEST', questId }), []);
  const buyItem = useCallback((merchantName, itemName) => dispatch({ type: 'BUY_ITEM', merchantName, itemName }), []);
  const sellToMerchant = useCallback(
    (merchantName, itemId) => dispatch({ type: 'SELL_TO_MERCHANT', merchantName, itemId }),
    [],
  );
  const learnSpell = useCallback((spellId) => dispatch({ type: 'LEARN_SPELL', spellId }), []);
  const equipSpell = useCallback((spellId, slotIndex) => dispatch({ type: 'EQUIP_SPELL', spellId, slotIndex }), []);
  const unequipSpell = useCallback((slotIndex) => dispatch({ type: 'UNEQUIP_SPELL', slotIndex }), []);
  const setAutoCastSpells = useCallback((enabled) => dispatch({ type: 'SET_AUTO_CAST_SPELLS', enabled }), []);
  const setSpellHealThreshold = useCallback(
    (spellId, pct) => dispatch({ type: 'SET_SPELL_HEAL_THRESHOLD', spellId, pct }),
    [],
  );

  // ── Comércio entre jogadores ──────────────────────────────────────────────
  // Mercado de preço fixo, tipo NPC: sem lance, sem espera — o comprador paga o preço
  // que o vendedor pediu e leva o item na hora. Cada função só mexe no PRÓPRIO
  // gold/banco (via dispatch) depois que a parte compartilhada já foi aceita no
  // Firestore — nunca escreve no personagem de outra conta. Ver services/firebase.js.
  const fetchListings = useCallback(() => loadListings(), []);

  const listItemOnMarket = useCallback(async (bankItemId, price) => {
    const char = characterRef.current;
    const uid = userRef.current?.uid;
    if (!char || !uid) return;
    const item = char.bank.find((i) => i.id === bankItemId);
    if (!item || item.quantity <= 0) throw new Error('Item não encontrado no banco.');

    const listing = {
      item: { ...item, quantity: 1 },
      sellerUid: uid,
      sellerName: char.name,
      price,
      status: 'active',
      createdAt: Date.now(),
    };
    // Tira o item do banco só depois que o anúncio foi criado com sucesso no Firestore
    // — se a criação falhar (sem internet etc.), o item continua no banco.
    await createListing(listing);
    dispatch({ type: 'MARKET_LIST_ITEM', itemId: bankItemId });
  }, []);

  const buyMarketListing = useCallback(async (listingId) => {
    const char = characterRef.current;
    const uid = userRef.current?.uid;
    if (!char || !uid) return;
    // A checagem de gold suficiente é feita ANTES da transação — a transação em si só
    // decide se o item ainda tá disponível (protege contra dois jogadores comprando o
    // mesmo item ao mesmo tempo). Só desconta o gold e entrega o item localmente
    // DEPOIS que ela confirmar a compra.
    const listing = (await loadListings()).find((l) => l.id === listingId);
    if (listing && char.gold < listing.price) throw new Error(`Gold insuficiente: você tem ${char.gold}g, precisa de ${listing.price}g.`);

    const result = await buyListingFirestore(listingId, { uid, name: char.name });
    dispatch({ type: 'MARKET_DEDUCT_GOLD', amount: result.price, message: `Você comprou ${result.item.name} por ${result.price}g.` });
    dispatch({ type: 'MARKET_ADD_BANK_ITEM', item: result.item });
  }, []);

  const cancelMarketListing = useCallback(async (listingId) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const item = await cancelListingFirestore(listingId, uid);
    if (item) {
      dispatch({ type: 'MARKET_ADD_BANK_ITEM', item, message: `Anúncio de ${item.name} cancelado — item de volta ao banco.` });
    }
  }, []);

  // Roda sempre que a aba de Comércio é aberta: recebe o gold de tudo que você já
  // vendeu (ninguém mais pode mexer no seu gold além de você mesmo).
  const reconcileMarketPayouts = useCallback(async (listings) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    for (const listing of listings) {
      if (listing.status === 'sold' && listing.sellerUid === uid && !listing.sellerPaid) {
        const amount = await claimSellerPayout(listing.id, uid);
        if (amount > 0) {
          dispatch({ type: 'MARKET_ADD_GOLD', amount, message: `${listing.item.name} vendido! +${amount}g.` });
        }
      }
    }
  }, []);

  return {
    character,
    monster: state.monster,
    log: state.log,
    autoCombat: state.autoCombat,
    setAutoCombat,
    setAutoEat,
    setAutoPotion,
    createNewCharacter,
    chooseVocation,
    vocationCost: VOCATION_COST,
    resetCharacter,
    consumeItem,
    sellItem,
    discardItem,
    depositItem,
    withdrawItem,
    addToBlacklist,
    removeFromBlacklist,
    equipItem,
    unequipItem,
    allocateStat,
    resetAttributes,
    respecCost: RESPEC_COST,
    investTalent,
    resetTalents,
    talentResetCost: state.character ? talentResetCost(state.character.talentResetCount) : TALENT_RESET_BASE_COST,
    talentPointsAvailable: state.character
      ? talentPointsForLevel(state.character.level) - spentTalentPoints(state.character.talentPoints)
      : 0,
    unspentPoints: state.character ? unspentPoints(state.character.levelBatches) : 0,
    weight,
    changeZone,
    claimQuest,
    buyItem,
    sellToMerchant,
    learnSpell,
    equipSpell,
    unequipSpell,
    setAutoCastSpells,
    setSpellHealThreshold,
    spellCooldowns: state.spellCooldowns,
    fetchListings,
    listItemOnMarket,
    buyMarketListing,
    cancelMarketListing,
    reconcileMarketPayouts,
    offlineReport,
    dismissOfflineReport,
    syncStatus,
    syncError,
    user,
    authLoading,
    authError,
    login,
    logout: signOutUser,
    zones: ZONES,
  };
}
