import { useState } from 'react';
import { CLASSES } from '../data/gameData';

export default function CharacterCreation({ onCreate }) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);

  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold mb-2 tracking-wide">APOGEA IDLE</h1>
        <p className="text-xs text-neutral-500 tracking-widest mb-3">— WHERE ADVENTURE NEVER SLEEPS —</p>
        <p className="text-neutral-400">Escolha um nome e uma classe pra começar</p>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do personagem"
        maxLength={20}
        className="w-full max-w-xs bg-wood-light border border-wood-lighter rounded px-3 py-2
                   text-center text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-gold"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {Object.values(CLASSES).map((cls) => (
          <button
            key={cls.name}
            onClick={() => setSelectedClass(cls.name)}
            className={`bg-wood-light border rounded-lg p-5 text-left transition-colors cursor-pointer
              ${selectedClass === cls.name ? 'border-gold bg-wood-lighter' : 'border-wood-lighter hover:border-gold'}`}
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

      <button
        onClick={() => selectedClass && onCreate(selectedClass, name)}
        disabled={!selectedClass}
        className="bg-gold text-wood font-semibold px-8 py-2.5 rounded hover:bg-yellow-500
                   disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        Começar aventura
      </button>
      <p className="text-xs text-neutral-500 -mt-4">
        Atenção: a vocação é definitiva — não dá pra trocar de classe depois.
      </p>
    </div>
  );
}
