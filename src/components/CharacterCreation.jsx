import { CLASSES } from '../data/gameData';

export default function CharacterCreation({ onCreate }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold mb-2">Apogea Idle</h1>
        <p className="text-neutral-400">Escolha sua classe para começar a aventura</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {Object.values(CLASSES).map((cls) => (
          <button
            key={cls.name}
            onClick={() => onCreate(cls.name)}
            className="bg-wood-light border border-wood-lighter rounded-lg p-5 text-left
                       hover:border-gold hover:bg-wood-lighter transition-colors cursor-pointer"
          >
            <h2 className="text-xl font-semibold text-gold mb-1">{cls.name}</h2>
            <p className="text-sm text-neutral-400 mb-3">{cls.description}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-300">
              <span>Vida: {cls.baseStats.health}</span>
              <span>Mana: {cls.baseStats.mana}</span>
              <span>Dano: {cls.baseStats.damage}</span>
              <span>Armadura: {cls.baseStats.armor}</span>
              <span>Vel. Ataque: {cls.baseStats.attackSpeed}</span>
              <span>Capacidade: {cls.baseStats.capacity}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
