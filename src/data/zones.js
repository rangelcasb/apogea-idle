import { MONSTERS_BY_NAME } from './monsters.js';
import { resolveRealItemName } from './lootItems.js';

// Zonas de caça REAIS (nome, região, descrição, xp/h, gold/h) — transcritas da tela
// "Zonas de Caça" que o usuário enviou (apogean.eu). O jogo real não expõe qual monstro
// exato habita cada zona (só ícones na imagem), então a lista de monstros de cada zona
// é nossa. minLevel das zonas reais sem trava visível foi estimado por progressão;
// Monastério Abandonado (30) e Trilha da Pestilência (35) são os níveis exatos
// mostrados com cadeado na imagem.
//
// A escolha de QUAIS monstros vão em cada zona segue a força real deles (vida + dano +
// armadura), em ordem crescente com o minLevel da zona — um personagem no nível mínimo
// da zona precisa conseguir bater de frente com QUALQUER monstro sorteado ali, então
// evitamos misturar um monstro fraquinho com um monstro muito acima da curva na mesma
// zona (era o caso do Giant Rat numa zona de nível baixo, ou do Lintwurm gigante de
// 20.000 de vida junto de uma aranha de 100 de vida em Cavernas de Nordha).
const REAL_ZONES = [
  {
    id: 'fazendas-de-basile', name: 'Fazendas de Basile', region: 'Basile', minLevel: 1,
    description: 'Campos tranquilos ao redor da cidade inicial. Ovelhas, cordeiros e ratos — perfeito para dar os primeiros golpes.',
    xpPerHour: 787, goldPerHour: 39,
    monsterNames: ['Sheep', 'Black Sheep', 'Lamb', 'Black Lamb', 'Rat', 'Deer'],
  },
  {
    id: 'esgotos-de-basile', name: 'Esgotos de Basile', region: 'Basile', minLevel: 3,
    description: 'Túneis úmidos sob a cidade. Esqueletos, lobos perdidos e bandidos se escondem na escuridão.',
    xpPerHour: 1959, goldPerHour: 306,
    monsterNames: ['Skeleton', 'Wolf', 'Occultist Apprentice', 'Bandit', 'Swamp Tentacle'],
  },
  // Zona custom a pedido do usuário — não é uma zona da imagem oficial do jogo, é um
  // "meio-termo" entre Fazendas (nível 1) e Esgotos (nível 3), só com Rat e Skeleton
  // (os dois já usados nas zonas vizinhas). xp/h e gold/h interpolados entre as duas.
  {
    id: 'becos-de-basile', name: 'Becos de Basile', region: 'Basile', minLevel: 2,
    description: 'A transição entre os campos e os esgotos — vielas estreitas onde só ratos e esqueletos rondam.',
    xpPerHour: 1200, goldPerHour: 150,
    monsterNames: ['Rat', 'Skeleton'],
  },
  {
    id: 'floresta-de-basile', name: 'Floresta de Basile', region: 'Basile', minLevel: 5,
    description: 'A mata fecha e cavernas escondem aranhas. Goblins e ocultistas iniciantes rondam as trilhas.',
    xpPerHour: 3571, goldPerHour: 92,
    monsterNames: ['Cave Spider', 'Goblin', 'Tock', 'Occultist Acolyte', 'Lava Snoop', 'Wisp'],
  },
  {
    id: 'estrada-da-caravana', name: 'Estrada da Caravana', region: 'Caravan', minLevel: 8,
    description: 'A rota comercial até a Caravana esconde criaturas estranhas nas valas e no mato alto.',
    xpPerHour: 4105, goldPerHour: 308,
    monsterNames: ['Walking Boletus', 'Plea', 'Rubellus', 'Plea Occultist'],
  },
  {
    id: 'colinas-dos-goblins', name: 'Colinas dos Goblins', region: 'Nordha', minLevel: 10,
    description: 'Acampamentos goblins e ratos gigantes espalhados pelas colinas a caminho de Nordha.',
    xpPerHour: 7000, goldPerHour: 430,
    monsterNames: ['Mireling', 'Crazed Occultist', 'Giant Rat', 'Lintwurm', 'Faun', 'Huntsman'],
  },
  {
    id: 'cavernas-de-nordha', name: 'Cavernas de Nordha', region: 'Nordha', minLevel: 12,
    description: 'Cavernas escuras cheias de goblins viscosos e ocultistas errantes.',
    xpPerHour: 8188, goldPerHour: 376,
    monsterNames: ['Viscid Goblin', 'Conquest Fowler', 'Occultist Scholar', 'Sunskin', 'Ghoul', 'Thug'],
  },
  {
    id: 'pantano-de-vecan', name: 'Pântano de Vecan', region: 'Swamp', minLevel: 15,
    description: 'Águas paradas onde imps, monges corrompidos e ursos ferozes espreitam.',
    xpPerHour: 11384, goldPerHour: 340,
    monsterNames: ['Imp', 'Monk', 'Digger', 'Bear', 'Smelt Ooze', 'Unstable Quartz'],
  },
  {
    id: 'circulo-ocultista', name: 'Círculo Ocultista', region: 'Plains', minLevel: 17,
    description: 'Cultistas e criaturas da pestilência se reúnem em círculos de pedra para rituais proibidos.',
    xpPerHour: 10921, goldPerHour: 472,
    monsterNames: ['Pestilence Spawn', 'Pestilence Stinger', 'Rat Shipper', 'Occultist Enforcer', 'Cube Of Doom', 'Fallen Wings', 'Cold Baron'],
  },
  {
    id: 'monasterio-abandonado', name: 'Monastério Abandonado', region: 'Plains', minLevel: 30,
    description: 'O olho da pestilência vigia entre amphiteres jovens e o bandido Capozzi nos corredores sagrados.',
    xpPerHour: 15000, goldPerHour: 600,
    monsterNames: ['Eye Of Pestilence', 'Young Amphitere', 'Pestilence Plague', 'Capozzi The Bandit', 'Skal Traitor', 'Queen Zoe'],
  },
  {
    id: 'trilha-da-pestilencia', name: 'Trilha da Pestilência', region: 'Swamp', minLevel: 35,
    description: 'A doença se espalha por esta trilha — aranhas do terror e o temido Gaglio à solta.',
    xpPerHour: 18000, goldPerHour: 700,
    monsterNames: ['Deadly Webcap', 'Gaglio The Bandit', 'The Gardener', 'The Broodmother', 'Obelisk', 'Minerva', 'Brother Rossi'],
  },
  {
    id: 'toca-do-alpha-wolf', name: 'Toca do Alpha Wolf', region: 'Nordha', minLevel: 20, boss: true,
    description: 'BOSS — O lendário Alpha Wolf aparece no centro de Nordha. Loot raro para quem aguentar.',
    xpPerHour: 9000, goldPerHour: 500,
    monsterNames: ['Alpha Wolf'],
  },
  {
    id: 'tundra-de-dorosam', name: 'Tundra de Dorosam', region: 'Dorosam', minLevel: 22,
    description: 'O frio do norte esconde sacerdotisas, ratos da tundra e serpentes ancestrais.',
    xpPerHour: 9500, goldPerHour: 420,
    monsterNames: ['Conquest Priestess', 'Tundra Rat', 'Ancient Snake', 'Sunskin Enchanter', 'Skal Brawler'],
  },
];

// Zonas ADICIONAIS (não estavam na imagem enviada — inventadas por nós só pra dar um
// lugar coerente aos monstros restantes do bestiário que não couberam nas zonas
// reais). xp/h e gold/h são estimativas, não dados do jogo.
const EXTRA_ZONES = [
  {
    id: 'deserto-de-sunskin', name: 'Deserto de Sunskin', region: 'Desert', minLevel: 24,
    description: 'Areias escaldantes onde criaturas devoradoras de ossos e xamãs orc espreitam.',
    xpPerHour: 13500, goldPerHour: 550,
    monsterNames: ['Bone Eater', 'Tomb Diviner', 'Orc Shaman', 'Mireling Noble', 'Omen'],
  },
  {
    id: 'acampamento-orc', name: 'Acampamento Orc', region: 'Nordha', minLevel: 25,
    description: 'Um exército orc se prepara nas planícies de guerra, com necromantes à espreita.',
    xpPerHour: 15800, goldPerHour: 610,
    monsterNames: ['Necromancer', 'Devil Spider', 'Orc Infantry', 'Grizzly Bear'],
  },
  {
    id: 'ruinas-da-conquista', name: 'Ruínas da Conquista', region: 'Plains', minLevel: 27,
    description: 'Vestígios de um exército derrotado — corvos, trabalhadores e guardiões tumulares assombram o local.',
    xpPerHour: 17200, goldPerHour: 680,
    monsterNames: ['Conquest Crow', 'Tomb Worker', 'Tomb Guardian', 'Orc Berserker', 'Ghost', 'Rotwurm'],
  },
  {
    id: 'covil-dos-foras-da-lei', name: 'Covil dos Foras-da-Lei', region: 'Caravan', minLevel: 28,
    description: 'Minotauros, trolls das cavernas e banshees se escondem onde os criminosos mais procurados vivem.',
    xpPerHour: 18000, goldPerHour: 900,
    monsterNames: ['Minotaur', 'Banshee', 'Cave Troll', 'Profaner'],
  },
  {
    id: 'covil-da-amphitere', name: 'Covil da Amphitere', region: 'Dorosam', minLevel: 33,
    description: 'Generais orc e trolls do pântano guardam esse ninho nas montanhas geladas.',
    xpPerHour: 24000, goldPerHour: 750,
    monsterNames: ['Orc General', 'Swamp Troll', 'Mateo The Bandit', 'Terror Spider', 'Bridge Troll'],
  },
  {
    id: 'fortaleza-pestilenta', name: 'Fortaleza Pestilenta', region: 'Swamp', minLevel: 40, boss: true,
    description: 'O coração da praga — só os mais fortes retornam.',
    xpPerHour: 40000, goldPerHour: 1200,
    monsterNames: ['Pestilence Knight'],
  },
  // 3 áreas de boss novas — antes esses 3 estavam amontoados dentro de "Domínio
  // Esquecido" junto com monstros bem mais fracos (Amphitere/The Augur/The Blackhat).
  // São os únicos 3, fora Pestilence Knight e Alpha Wolf, com "poder" (health +
  // dano×8 + armadura×4, mesma fórmula usada pra montar todas as zonas) muito acima
  // da média — mereciam covil próprio em vez de dividir zona com bicho fraco.
  {
    id: 'covil-do-cavaleiro-negro', name: 'Covil do Cavaleiro Negro', region: 'Plains', minLevel: 36, boss: true,
    description: 'BOSS — A armadura enegrecida do Cavaleiro Negro ainda protege esse covil esquecido.',
    xpPerHour: 15600, goldPerHour: 475,
    monsterNames: ['The Black Knight'],
  },
  {
    id: 'trono-do-titan', name: 'Trono do Titã', region: 'Plains', minLevel: 38, boss: true,
    description: 'BOSS — Um gigante de pedra e fúria guarda o que restou de um trono antigo.',
    xpPerHour: 17300, goldPerHour: 520,
    monsterNames: ['Titan'],
  },
  {
    id: 'fortim-da-conquista', name: 'Fortim da Conquista', region: 'Plains', minLevel: 42, boss: true,
    description: 'BOSS — O último general de um exército derrotado ainda defende seu fortim, quase tão perigoso quanto o Pestilence Knight.',
    xpPerHour: 31600, goldPerHour: 950,
    monsterNames: ['Conquest Champion'],
  },
  // Os 6 monstros que sobraram em "Domínio Esquecido" também viraram covil solo, a
  // pedido do usuário — mesmo raciocínio dos 3 extraídos acima, só que aplicado ao
  // resto da zona inteira em vez de só aos maiores outliers. xp/h e gold/h escalados
  // pela mesma proporção (poder/poder do Pestilence Knight × xp/gold da Fortaleza
  // Pestilenta), minLevel crescente conforme o poder de cada um.
  {
    id: 'covil-do-chapeu-negro', name: 'Covil do Chapéu Negro', region: 'Plains', minLevel: 44, boss: true,
    description: 'BOSS — O misterioso Blackhat ainda ronda essas ruínas, escondendo segredos antigos.',
    xpPerHour: 11400, goldPerHour: 340,
    monsterNames: ['The Blackhat'],
  },
  {
    id: 'torre-do-augur', name: 'Torre do Augur', region: 'Plains', minLevel: 44, boss: true,
    description: 'BOSS — O Augur enxerga o futuro do alto de sua torre isolada.',
    xpPerHour: 11400, goldPerHour: 340,
    monsterNames: ['The Augur'],
  },
  {
    id: 'ninho-da-amphitere', name: 'Ninho da Amphitere', region: 'Plains', minLevel: 45, boss: true,
    description: 'BOSS — A lendária Amphitere ainda vigia seu ninho nas ruínas esquecidas.',
    xpPerHour: 13400, goldPerHour: 400,
    monsterNames: ['Amphitere'],
  },
  {
    id: 'caverna-do-grande-lintwurm', name: 'Caverna do Grande Lintwurm', region: 'Plains', minLevel: 46, boss: true,
    description: 'BOSS — Nas profundezas da caverna, um Lintwurm gigante espera.',
    xpPerHour: 23000, goldPerHour: 690,
    monsterNames: ['Great Lintwurm (Cave)'],
  },
  {
    id: 'covil-do-grande-lintwurm', name: 'Covil do Grande Lintwurm', region: 'Plains', minLevel: 47, boss: true,
    description: 'BOSS — O maior dos Lintwurms guarda seu covil sozinho.',
    xpPerHour: 30500, goldPerHour: 915,
    monsterNames: ['Great Lintwurm'],
  },
  {
    id: 'cripta-do-lintwurm-cristalizado', name: 'Cripta do Lintwurm Cristalizado', region: 'Plains', minLevel: 48, boss: true,
    description: 'BOSS — Uma variante cristalizada do Grande Lintwurm, imóvel mas mortal.',
    xpPerHour: 30600, goldPerHour: 920,
    monsterNames: ['Great Lintwurm (Static)'],
  },
];

export const ZONES = [...REAL_ZONES, ...EXTRA_ZONES].map((zone) => ({
  ...zone,
  monsters: zone.monsterNames.map((name) => MONSTERS_BY_NAME[name]).filter(Boolean),
}));

// Índice item canônico -> zonas onde ele pode cair (e quais monstros especificamente
// dropam ali) — usado pelo "Item Farm" da aba Caçada. As tabelas de loot dos monstros
// usam grafia antiga pra alguns itens (mesmo caso já corrigido no rollLoot), então
// resolve pro nome canônico antes de indexar, senão o filtro não bateria com o nome
// que o jogador escolhe (que vem do catálogo real, items.js).
const ITEM_FARM_INDEX = {};
for (const zone of ZONES) {
  for (const monster of zone.monsters) {
    for (const drop of monster.loot ?? []) {
      if (drop.name === 'Gold') continue;
      const resolvedName = resolveRealItemName(drop.name);
      if (!ITEM_FARM_INDEX[resolvedName]) ITEM_FARM_INDEX[resolvedName] = [];
      let entry = ITEM_FARM_INDEX[resolvedName].find((e) => e.zoneId === zone.id);
      if (!entry) {
        entry = { zoneId: zone.id, monsterNames: [] };
        ITEM_FARM_INDEX[resolvedName].push(entry);
      }
      if (!entry.monsterNames.includes(monster.name)) entry.monsterNames.push(monster.name);
    }
  }
}

// Devolve, pra um nome de item canônico, a lista de zonas (objeto ZONES completo) que
// têm pelo menos um monstro que dropa ele, junto com quais monstros especificamente.
export function zonesForItem(itemName) {
  const entries = ITEM_FARM_INDEX[itemName] ?? [];
  return entries
    .map((e) => ({ zone: ZONES.find((z) => z.id === e.zoneId), monsterNames: e.monsterNames }))
    .filter((e) => e.zone);
}

// Todo item que aparece em pelo menos uma tabela de loot — usado pro seletor do Item
// Farm mostrar só itens que fazem sentido buscar (em vez da lista inteira do catálogo,
// que também tem item de loja/craft sem monstro nenhum dropando).
export const FARMABLE_ITEM_NAMES = Object.keys(ITEM_FARM_INDEX).sort();
