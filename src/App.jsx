import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import CharacterCreation from './components/CharacterCreation';
import Cacada from './components/Cacada';
import Personagem from './components/Personagem';
import Mochila from './components/Mochila';
import Talentos from './components/Talentos';
import Sidebar from './components/Sidebar';

const TABS = [
  { id: 'cacada', label: '🗡 Caçada', implemented: true },
  { id: 'personagem', label: '🧍 Personagem', implemented: true },
  { id: 'mochila', label: '🎒 Mochila', implemented: true },
  { id: 'talentos', label: '🌳 Talentos', implemented: true },
  { id: 'quests', label: '📜 Quests', implemented: false },
  { id: 'mercador', label: '💱 Mercador', implemented: false },
  { id: 'banco', label: '🏦 Banco', implemented: false },
  { id: 'house', label: '🏠 House', implemented: false },
  { id: 'bestiario', label: '📖 Bestiário', implemented: false },
  { id: 'ranking', label: '🏆 Ranking', implemented: false },
];

function ComingSoon({ label }) {
  return (
    <div className="flex-1 bg-wood-light border border-wood-lighter rounded-lg p-8 text-center">
      <p className="text-neutral-400">{label} ainda não foi implementado nessa versão.</p>
    </div>
  );
}

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
    sellItem,
    discardItem,
    equipItem,
    unequipItem,
    allocateStat,
    resetAttributes,
    respecCost,
    investTalent,
    talentPointsAvailable,
    unspentPoints,
    weight,
    changeZone,
    zones,
  } = useGameState();

  const [activeTab, setActiveTab] = useState('cacada');

  if (!character) {
    return <CharacterCreation onCreate={createNewCharacter} />;
  }

  const currentZone = zones.find((z) => z.id === character.zoneId);

  return (
    <div className="max-w-6xl mx-auto min-h-svh flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-wood-lighter">
        <div>
          <h1 className="text-xl font-bold text-gold tracking-wide">APOGEA IDLE</h1>
          <p className="text-[10px] text-neutral-600 tracking-widest">— WHERE ADVENTURE NEVER SLEEPS —</p>
        </div>
        <button
          onClick={resetCharacter}
          className="text-xs text-neutral-400 hover:text-blood cursor-pointer"
        >
          Novo personagem
        </button>
      </header>

      <nav className="flex flex-wrap border-b border-wood-lighter">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap
              ${activeTab === tab.id
                ? 'text-gold border-b-2 border-gold bg-wood-light'
                : 'text-neutral-500 hover:text-neutral-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        {activeTab === 'cacada' && (
          <Cacada
            character={character}
            monster={monster}
            log={log}
            autoCombat={autoCombat}
            setAutoCombat={setAutoCombat}
            zones={zones}
            changeZone={changeZone}
          />
        )}
        {activeTab === 'personagem' && (
          <Personagem
            character={character}
            unspentPoints={unspentPoints}
            allocateStat={allocateStat}
            resetAttributes={resetAttributes}
            respecCost={respecCost}
            unequipItem={unequipItem}
          />
        )}
        {activeTab === 'mochila' && (
          <Mochila
            character={character}
            weight={weight}
            consumeItem={consumeItem}
            equipItem={equipItem}
            sellItem={sellItem}
            discardItem={discardItem}
          />
        )}
        {activeTab === 'talentos' && (
          <Talentos character={character} talentPointsAvailable={talentPointsAvailable} investTalent={investTalent} />
        )}
        {!TABS.find((t) => t.id === activeTab)?.implemented && (
          <ComingSoon label={TABS.find((t) => t.id === activeTab)?.label} />
        )}

        <Sidebar character={character} autoCombat={autoCombat} weight={weight} zoneName={currentZone?.name} />
      </main>
    </div>
  );
}
