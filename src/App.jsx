import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import CharacterCreation from './components/CharacterCreation';
import Cacada from './components/Cacada';
import Personagem from './components/Personagem';
import Talentos from './components/Talentos';
import Quests from './components/Quests';
import Mercador from './components/Mercador';
import Sidebar from './components/Sidebar';

const TABS = [
  { id: 'cacada', label: '🗡 Caçada', implemented: true },
  { id: 'personagem', label: '🧍 Personagem', implemented: true },
  { id: 'talentos', label: '🌳 Talentos', implemented: true },
  { id: 'quests', label: '📜 Quests', implemented: true },
  { id: 'mercador', label: '💱 Mercador', implemented: true },
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
    chooseVocation,
    vocationCost,
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
    claimQuest,
    buyItem,
    sellToMerchant,
    syncStatus,
    user,
    authLoading,
    authError,
    login,
    logout,
    zones,
  } = useGameState();

  const [activeTab, setActiveTab] = useState('cacada');

  if (authLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-8 min-h-svh px-4 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gold mb-2 tracking-wide">APOGEA IDLE</h1>
          <p className="text-xs text-neutral-500 tracking-widest mb-3">— WHERE ADVENTURE NEVER SLEEPS —</p>
          <p className="text-neutral-400">Entre com sua conta Google pra jogar e sincronizar entre dispositivos.</p>
        </div>
        <button
          onClick={login}
          className="bg-gold text-wood font-semibold px-8 py-2.5 rounded hover:bg-yellow-500 cursor-pointer"
        >
          Entrar com Google
        </button>
        {authError && (
          <p className="text-xs text-blood max-w-sm bg-wood-light border border-wood-lighter rounded px-3 py-2">
            Erro no login: {authError}
          </p>
        )}
      </div>
    );
  }

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
        <div className="flex items-center gap-4">
          <button
            onClick={resetCharacter}
            className="text-xs text-neutral-400 hover:text-blood cursor-pointer"
          >
            Novo personagem
          </button>
          <button
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-blood cursor-pointer"
          >
            Sair
          </button>
        </div>
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
            weight={weight}
            consumeItem={consumeItem}
            equipItem={equipItem}
            sellItem={sellItem}
            discardItem={discardItem}
            chooseVocation={chooseVocation}
            vocationCost={vocationCost}
          />
        )}
        {activeTab === 'talentos' && (
          <Talentos character={character} talentPointsAvailable={talentPointsAvailable} investTalent={investTalent} />
        )}
        {activeTab === 'quests' && (
          <Quests character={character} zones={zones} claimQuest={claimQuest} />
        )}
        {activeTab === 'mercador' && (
          <Mercador character={character} buyItem={buyItem} sellToMerchant={sellToMerchant} />
        )}
        {!TABS.find((t) => t.id === activeTab)?.implemented && (
          <ComingSoon label={TABS.find((t) => t.id === activeTab)?.label} />
        )}

        <Sidebar
          character={character}
          autoCombat={autoCombat}
          weight={weight}
          zoneName={currentZone?.name}
          syncStatus={syncStatus}
          user={user}
          onLogout={logout}
        />
      </main>
    </div>
  );
}
