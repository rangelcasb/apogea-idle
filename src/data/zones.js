import { MONSTERS_BY_NAME } from './monsters.js';

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
    monsterNames: ['Skeleton', 'Wolf', 'Occultist Apprentice', 'Bandit'],
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
    monsterNames: ['Cave Spider', 'Goblin', 'Tock', 'Occultist Acolyte'],
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
    monsterNames: ['Mireling', 'Crazed Occultist', 'Giant Rat', 'Lintwurm'],
  },
  {
    id: 'cavernas-de-nordha', name: 'Cavernas de Nordha', region: 'Nordha', minLevel: 12,
    description: 'Cavernas escuras cheias de goblins viscosos e ocultistas errantes.',
    xpPerHour: 8188, goldPerHour: 376,
    monsterNames: ['Viscid Goblin', 'Conquest Fowler', 'Occultist Scholar', 'Sunskin'],
  },
  {
    id: 'pantano-de-vecan', name: 'Pântano de Vecan', region: 'Swamp', minLevel: 15,
    description: 'Águas paradas onde imps, monges corrompidos e ursos ferozes espreitam.',
    xpPerHour: 11384, goldPerHour: 340,
    monsterNames: ['Imp', 'Monk', 'Digger', 'Bear'],
  },
  {
    id: 'circulo-ocultista', name: 'Círculo Ocultista', region: 'Plains', minLevel: 17,
    description: 'Cultistas e criaturas da pestilência se reúnem em círculos de pedra para rituais proibidos.',
    xpPerHour: 10921, goldPerHour: 472,
    monsterNames: ['Pestilence Spawn', 'Pestilence Stinger', 'Rat Shipper', 'Occultist Enforcer', 'Cube Of Doom'],
  },
  {
    id: 'monasterio-abandonado', name: 'Monastério Abandonado', region: 'Plains', minLevel: 30,
    description: 'O olho da pestilência vigia entre amphiteres jovens e o bandido Capozzi nos corredores sagrados.',
    xpPerHour: 15000, goldPerHour: 600,
    monsterNames: ['Eye Of Pestilence', 'Young Amphitere', 'Pestilence Plague', 'Capozzi The Bandit'],
  },
  {
    id: 'trilha-da-pestilencia', name: 'Trilha da Pestilência', region: 'Swamp', minLevel: 35,
    description: 'A doença se espalha por esta trilha — aranhas do terror e o temido Gaglio à solta.',
    xpPerHour: 18000, goldPerHour: 700,
    monsterNames: ['Deadly Webcap', 'Gaglio The Bandit', 'The Gardener', 'The Broodmother', 'Obelisk'],
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
    monsterNames: ['Conquest Priestess', 'Tundra Rat', 'Ancient Snake', 'Sunskin Enchanter'],
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
    monsterNames: ['Bone Eater', 'Tomb Diviner', 'Orc Shaman', 'Mireling Noble'],
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
    monsterNames: ['Conquest Crow', 'Tomb Worker', 'Tomb Guardian', 'Orc Berserker'],
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
    monsterNames: ['Orc General', 'Swamp Troll', 'Mateo The Bandit', 'Terror Spider'],
  },
  {
    id: 'fortaleza-pestilenta', name: 'Fortaleza Pestilenta', region: 'Swamp', minLevel: 40, boss: true,
    description: 'O coração da praga — só os mais fortes retornam.',
    xpPerHour: 40000, goldPerHour: 1200,
    monsterNames: ['Pestilence Knight'],
  },
  {
    id: 'dominio-esquecido', name: 'Domínio Esquecido', region: 'Plains', minLevel: 45,
    description: 'Guardiões antigos e a lendária Amphitere ainda vigiam ruínas esquecidas.',
    xpPerHour: 45000, goldPerHour: 1000,
    monsterNames: ['The Blackhat', 'The Augur', 'Amphitere', 'Great Lintwurm (Cave)', 'Great Lintwurm'],
  },
];

export const ZONES = [...REAL_ZONES, ...EXTRA_ZONES].map((zone) => ({
  ...zone,
  monsters: zone.monsterNames.map((name) => MONSTERS_BY_NAME[name]).filter(Boolean),
}));
