import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import CharacterCreation from './components/CharacterCreation';
import Combat from './components/Combat';
import Stats from './components/Stats';
import Inventory from './components/Inventory';

const TABS = [
  { id: 'combat', label: 'Combate' },
  { id: 'stats', label: 'Stats' },
  { id: 'inventory', label: 'Inventário' },
];

export default function App() {
  const {
    character,
    monster,
    log,
    autoCombat,
    setAutoCombat,
    createNewCharacter,
    resetCharacter,
    consumeItem,
    equipItem,
    unequipItem,
    allocateStat,
    unspentPoints,
    changeZone,
    zones,
  } = useGameState();

  const [activeTab, setActiveTab] = useState('combat');

  if (!character) {
    return <CharacterCreation onCreate={createNewCharacter} />;
  }

  return (
    <div className="max-w-2xl mx-auto min-h-svh flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-wood-lighter">
        <h1 className="text-xl font-bold text-gold">Apogea Idle</h1>
        <button
          onClick={resetCharacter}
          className="text-xs text-neutral-400 hover:text-blood cursor-pointer"
        >
          Novo personagem
        </button>
      </header>

      <nav className="flex border-b border-wood-lighter">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer
              ${activeTab === tab.id
                ? 'text-gold border-b-2 border-gold bg-wood-light'
                : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {activeTab === 'combat' && (
          <Combat
            character={character}
            monster={monster}
            log={log}
            autoCombat={autoCombat}
            setAutoCombat={setAutoCombat}
            zones={zones}
            changeZone={changeZone}
          />
        )}
        {activeTab === 'stats' && (
          <Stats character={character} unspentPoints={unspentPoints} allocateStat={allocateStat} />
        )}
        {activeTab === 'inventory' && (
          <Inventory
            character={character}
            consumeItem={consumeItem}
            equipItem={equipItem}
            unequipItem={unequipItem}
          />
        )}
      </main>
    </div>
  );
}
