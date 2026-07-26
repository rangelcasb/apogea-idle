import { useState } from 'react';

export default function CharacterCreation({ onCreate }) {
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center gap-8 py-16 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold mb-2 tracking-wide">APOGEA IDLE</h1>
        <p className="text-xs text-neutral-500 tracking-widest mb-3">— WHERE ADVENTURE NEVER SLEEPS —</p>
        <p className="text-neutral-400">Escolha um nome pra começar como Squire</p>
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

      <button
        onClick={() => onCreate(name)}
        className="bg-gold text-wood font-semibold px-8 py-2.5 rounded hover:bg-yellow-500 cursor-pointer"
      >
        Começar aventura
      </button>
      <p className="text-xs text-neutral-500 max-w-sm text-center">
        Todo mundo começa como Squire, sem vocação. Depois de juntar 100 gold, escolha
        entre Knight, Rogue ou Mage na aba Personagem — essa escolha é definitiva.
      </p>
    </div>
  );
}
