export default function Combat({ character, monster, log, autoCombat, setAutoCombat, zones, changeZone }) {
  const hpPct = Math.max(0, (character.currentHealth / character.stats.health) * 100);
  const monsterHpPct = monster ? Math.max(0, (monster.currentHealth / monster.maxHealth) * 100) : 0;
  const isDead = character.currentHealth <= 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-neutral-400">Zona:</label>
        <select
          value={character.zoneId}
          onChange={(e) => changeZone(e.target.value)}
          className="bg-wood-light border border-wood-lighter rounded px-2 py-1 text-sm text-neutral-200"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} (nível {z.minLevel}+)
            </option>
          ))}
        </select>

        <button
          onClick={() => setAutoCombat((v) => !v)}
          disabled={isDead}
          className={`ml-auto px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer
            ${autoCombat ? 'bg-blood text-white hover:bg-red-800' : 'bg-gold text-wood hover:bg-yellow-500'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {autoCombat ? 'Parar Combate' : 'Iniciar Combate Automático'}
        </button>
      </div>

      {isDead && (
        <div className="bg-blood/20 border border-blood rounded p-3 text-center text-sm">
          Você foi derrotado. Descanse (recupere vida) ou recarregue a página para continuar.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold mb-2">{character.class} (Nv. {character.level})</h3>
          <div className="h-3 bg-wood rounded overflow-hidden mb-1">
            <div className="h-full bg-blood transition-all" style={{ width: `${hpPct}%` }} />
          </div>
          <p className="text-xs text-neutral-400">
            {Math.max(0, Math.round(character.currentHealth))} / {character.stats.health} HP
          </p>
        </div>

        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold mb-2">{monster ? monster.name : '...'}</h3>
          <div className="h-3 bg-wood rounded overflow-hidden mb-1">
            <div className="h-full bg-green-600 transition-all" style={{ width: `${monsterHpPct}%` }} />
          </div>
          <p className="text-xs text-neutral-400">
            {monster ? `${Math.max(0, Math.round(monster.currentHealth))} / ${monster.maxHealth} HP` : ''}
          </p>
        </div>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-3 h-56 overflow-y-auto flex flex-col-reverse gap-1">
        {log.map((entry) => (
          <p key={entry.id} className="text-xs text-neutral-300">
            {entry.message}
          </p>
        ))}
      </div>
    </div>
  );
}
