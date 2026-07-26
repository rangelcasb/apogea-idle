import { xpForNextLevel, getDailyBoostedMonster, BOOSTED_MULTIPLIER } from '../data/gameData';

const SYNC_STATUS_LABEL = {
  idle: '',
  syncing: 'Sincronizando...',
  synced: 'Sincronizado ✓',
  error: 'Erro ao sincronizar',
  'not-found': '',
};

export default function Sidebar({ character, autoCombat, weight, zoneName, syncCode, syncStatus }) {
  const needed = xpForNextLevel(character.level);
  const xpPct = Math.min(100, (character.xp / needed) * 100);
  const hpPct = Math.max(0, (character.currentHealth / character.stats.health) * 100);
  const mpPct = Math.max(0, (character.currentMana / character.stats.mana) * 100);
  const boosted = getDailyBoostedMonster();

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-72 shrink-0">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-2">◆ {character.name.toUpperCase()}</h3>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm text-neutral-300">{character.class} nível {character.level}</span>
          <span className="text-sm text-gold">💰 {character.gold.toLocaleString('pt-BR')}</span>
        </div>

        <div className="h-4 bg-wood rounded overflow-hidden mb-1 relative">
          <div className="h-full bg-blood transition-all" style={{ width: `${hpPct}%` }} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-100">
            HP {Math.round(character.currentHealth)} / {Math.round(character.stats.health)}
          </span>
        </div>
        <div className="h-4 bg-wood rounded overflow-hidden mb-1 relative">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${mpPct}%` }} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-100">
            MP {Math.round(character.currentMana)} / {Math.round(character.stats.mana)}
          </span>
        </div>
        <div className="h-3 bg-wood rounded overflow-hidden mb-2 relative">
          <div className="h-full bg-gold transition-all" style={{ width: `${xpPct}%` }} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] text-wood font-medium">
            XP {xpPct.toFixed(0)}%
          </span>
        </div>

        <p className="text-xs text-neutral-400">
          {autoCombat ? `⚔️ Caçando em ${zoneName ?? '...'}` : '🏠 Descansando na cidade'}
        </p>
        {character.satiety?.remainingMs > 0 && (
          <p className="text-xs text-green-500 mt-1">
            🍖 Saciado ({character.satiety.foodName}) por mais {Math.ceil(character.satiety.remainingMs / 60000)}min
          </p>
        )}
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-2">◆ SINCRONIZAÇÃO</h3>
        <p className="text-[11px] text-neutral-500 mb-2">
          Use esse código pra continuar no celular (ou qualquer outro navegador).
        </p>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-center text-lg font-bold text-gold tracking-widest bg-wood rounded py-1.5">
            {syncCode ?? '------'}
          </span>
          <button
            onClick={() => syncCode && navigator.clipboard.writeText(syncCode)}
            className="text-xs font-medium bg-wood-lighter px-2.5 py-2 rounded cursor-pointer hover:text-gold"
          >
            Copiar
          </button>
        </div>
        {syncStatus && SYNC_STATUS_LABEL[syncStatus] && (
          <p className="text-[10px] text-neutral-500 mt-1">{SYNC_STATUS_LABEL[syncStatus]}</p>
        )}
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-2">◆ BOOSTED DO DIA</h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="font-medium text-neutral-100">{boosted.name}</p>
            <p className="text-xs text-gold">+{Math.round((BOOSTED_MULTIPLIER - 1) * 100)}% XP e gold hoje</p>
          </div>
        </div>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-3">◆ ESTATÍSTICAS</h3>
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-neutral-400">Abates</dt>
          <dd className="text-right text-neutral-100">{character.kills.toLocaleString('pt-BR')}</dd>
          <dt className="text-neutral-400">Mortes</dt>
          <dd className="text-right text-neutral-100">{character.deaths.toLocaleString('pt-BR')}</dd>
          <dt className="text-neutral-400">Gold acumulado</dt>
          <dd className="text-right text-neutral-100">{character.totalGoldEarned.toLocaleString('pt-BR')}</dd>
          <dt className="text-neutral-400">XP acumulado</dt>
          <dd className="text-right text-neutral-100">{character.totalXpEarned.toLocaleString('pt-BR')}</dd>
          <dt className="text-neutral-400">Peso</dt>
          <dd className="text-right text-neutral-100">
            {Math.round(weight)} / {Math.round(character.stats.capacity)} oz
          </dd>
        </dl>
      </div>
    </aside>
  );
}
