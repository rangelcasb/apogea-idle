import { MONSTERS_BY_NAME } from './monsters.js';

// Zonas de caça REAIS (nome, região, descrição, xp/h, gold/h) — transcritas da tela
// "Zonas de Caça" que o usuário enviou (apogean.eu). O jogo real não expõe qual monstro
// exato habita cada zona (só ícones na imagem), então a lista de monstros de cada zona
// é nossa, escolhida por coerência temática com a descrição real (ex: "ovelhas, cordeiros
// e ratos" -> Sheep/Lamb/Rat). minLevel das zonas reais sem trava visível foi estimado
// por progressão; Monastério Abandonado (30) e Trilha da Pestilência (35) são os níveis
// exatos mostrados com cadeado na imagem.
const REAL_ZONES = [
  {
    id: 'fazendas-de-basile', name: 'Fazendas de Basile', region: 'Basile', minLevel: 1,
    description: 'Campos tranquilos ao redor da cidade inicial. Ovelhas, cordeiros e ratos — perfeito para dar os primeiros golpes.',
    xpPerHour: 787, goldPerHour: 39,
    monsterNames: ['Sheep', 'Black Sheep', 'Lamb', 'Black Lamb', 'Rat', 'Deer'],
  },
  {
    id: 'esgotos-de-basile', name: 'Esgotos de Basile', region: 'Basile', minLevel: 3,
    description: 'Túneis úmidos sob a cidade. Ratos gigantes e esqueletos guardam moedas perdidas.',
    xpPerHour: 1959, goldPerHour: 306,
    monsterNames: ['Giant Rat', 'Skeleton', 'Rat Shipper'],
  },
  {
    id: 'floresta-de-basile', name: 'Floresta de Basile', region: 'Basile', minLevel: 5,
    description: 'A mata fecha e os lobos uivam. Cuidado com bandidos na estrada.',
    xpPerHour: 3571, goldPerHour: 92,
    monsterNames: ['Wolf', 'Bandit', 'Bear'],
  },
  {
    id: 'estrada-da-caravana', name: 'Estrada da Caravana', region: 'Caravan', minLevel: 8,
    description: 'A rota comercial até a Caravana é infestada de bandidos e goblins.',
    xpPerHour: 4105, goldPerHour: 308,
    monsterNames: ['Capozzi The Bandit', 'Gaglio The Bandit', 'Mateo The Bandit', 'Goblin'],
  },
  {
    id: 'colinas-dos-goblins', name: 'Colinas dos Goblins', region: 'Nordha', minLevel: 10,
    description: 'Acampamentos goblins espalhados pelas colinas a caminho de Nordha.',
    xpPerHour: 7000, goldPerHour: 430,
    monsterNames: ['Viscid Goblin', 'Digger', 'Mireling'],
  },
  {
    id: 'cavernas-de-nordha', name: 'Cavernas de Nordha', region: 'Nordha', minLevel: 12,
    description: 'Cavernas escuras cheias de aranhas e lintwurms jovens.',
    xpPerHour: 8188, goldPerHour: 376,
    monsterNames: ['Cave Spider', 'Cave Troll', 'Lintwurm', 'Great Lintwurm (Cave)', 'Ancient Snake'],
  },
  {
    id: 'pantano-de-vecan', name: 'Pântano de Vecan', region: 'Swamp', minLevel: 15,
    description: 'Águas paradas e criaturas viscosas. O cheiro é tão perigoso quanto os Pleas.',
    xpPerHour: 11384, goldPerHour: 340,
    monsterNames: ['Plea', 'Plea Occultist', 'Mireling Noble', 'Swamp Troll', 'Bone Eater'],
  },
  {
    id: 'circulo-ocultista', name: 'Círculo Ocultista', region: 'Plains', minLevel: 17,
    description: 'Cultistas se reúnem em círculos de pedra para rituais proibidos.',
    xpPerHour: 10921, goldPerHour: 472,
    monsterNames: ['Crazed Occultist', 'Occultist Acolyte', 'Occultist Apprentice', 'Occultist Enforcer', 'Occultist Scholar', 'Cube Of Doom', 'Necromancer'],
  },
  {
    id: 'monasterio-abandonado', name: 'Monastério Abandonado', region: 'Plains', minLevel: 30,
    description: 'Monges corrompidos e imps vagam pelos corredores sagrados.',
    xpPerHour: 15000, goldPerHour: 600,
    monsterNames: ['Monk', 'Imp', 'Profaner', 'Tomb Diviner', 'Tomb Guardian', 'Tomb Worker'],
  },
  {
    id: 'trilha-da-pestilencia', name: 'Trilha da Pestilência', region: 'Swamp', minLevel: 35,
    description: 'A doença se espalha por esta trilha. Stingers e spawns da pestilência à solta.',
    xpPerHour: 18000, goldPerHour: 700,
    monsterNames: ['Pestilence Spawn', 'Pestilence Stinger', 'Pestilence Plague', 'Eye Of Pestilence', 'Devil Spider'],
  },
  {
    id: 'toca-do-alpha-wolf', name: 'Toca do Alpha Wolf', region: 'Nordha', minLevel: 20, boss: true,
    description: 'BOSS — O lendário Alpha Wolf aparece no centro de Nordha. Loot raro para quem aguentar.',
    xpPerHour: 9000, goldPerHour: 500,
    monsterNames: ['Alpha Wolf'],
  },
  {
    id: 'tundra-de-dorosam', name: 'Tundra de Dorosam', region: 'Dorosam', minLevel: 22,
    description: 'O frio do norte esconde ursos ferozes e ratos da tundra.',
    xpPerHour: 9500, goldPerHour: 420,
    monsterNames: ['Grizzly Bear', 'Tundra Rat'],
  },
];

// Zonas ADICIONAIS (não estavam na imagem enviada — inventadas por nós só pra dar um
// lugar coerente aos monstros restantes do bestiário que não couberam nas 12 zonas
// reais). xp/h e gold/h são estimativas, não dados do jogo.
const EXTRA_ZONES = [
  {
    id: 'deserto-de-sunskin', name: 'Deserto de Sunskin', region: 'Desert', minLevel: 24,
    description: 'Areias escaldantes onde criaturas queimadas de sol espreitam.',
    xpPerHour: 13500, goldPerHour: 550,
    monsterNames: ['Sunskin', 'Sunskin Enchanter', 'Walking Boletus', 'Rubellus'],
  },
  {
    id: 'acampamento-orc', name: 'Acampamento Orc', region: 'Nordha', minLevel: 25,
    description: 'Um exército orc se prepara nas planícies de guerra.',
    xpPerHour: 15800, goldPerHour: 610,
    monsterNames: ['Orc Infantry', 'Orc Berserker', 'Orc Shaman', 'Orc General'],
  },
  {
    id: 'ruinas-da-conquista', name: 'Ruínas da Conquista', region: 'Plains', minLevel: 27,
    description: 'Vestígios de um exército derrotado, agora assombrados.',
    xpPerHour: 17200, goldPerHour: 680,
    monsterNames: ['Conquest Crow', 'Conquest Fowler', 'Conquest Priestess', 'Banshee'],
  },
  {
    id: 'covil-dos-foras-da-lei', name: 'Covil dos Foras-da-Lei', region: 'Caravan', minLevel: 28,
    description: 'Onde os criminosos mais procurados se escondem.',
    xpPerHour: 18000, goldPerHour: 900,
    monsterNames: ['The Blackhat', 'Minotaur', 'Tock'],
  },
  {
    id: 'covil-da-amphitere', name: 'Covil da Amphitere', region: 'Dorosam', minLevel: 33,
    description: 'Ninho nas montanhas geladas de uma criatura alada lendária.',
    xpPerHour: 24000, goldPerHour: 750,
    monsterNames: ['Young Amphitere', 'Amphitere', 'Terror Spider', 'Deadly Webcap'],
  },
  {
    id: 'fortaleza-pestilenta', name: 'Fortaleza Pestilenta', region: 'Swamp', minLevel: 40, boss: true,
    description: 'O coração da praga — só os mais fortes retornam.',
    xpPerHour: 40000, goldPerHour: 1200,
    monsterNames: ['Pestilence Knight'],
  },
  {
    id: 'dominio-esquecido', name: 'Domínio Esquecido', region: 'Plains', minLevel: 45,
    description: 'Guardiões antigos e enigmas que ainda vigiam ruínas esquecidas.',
    xpPerHour: 45000, goldPerHour: 1000,
    monsterNames: ['Obelisk', 'The Gardener', 'The Augur', 'The Broodmother'],
  },
];

export const ZONES = [...REAL_ZONES, ...EXTRA_ZONES].map((zone) => ({
  ...zone,
  monsters: zone.monsterNames.map((name) => MONSTERS_BY_NAME[name]).filter(Boolean),
}));
