export default function Cacada({ character, monster, log, autoCombat, setAutoCombat, zones, changeZone }) {
  const isDead = character.currentHealth <= 0;

  // Enquanto está caçando (combate automático ligado), mostra o painel de combate ao
  // vivo. Fora de combate, mostra a grade de zonas — igual à tela "Zonas de Caça".
  if (autoCombat) {
    const hpPct = Math.max(0, (character.currentHealth / character.stats.health) * 100);
    const monsterHpPct = monster ? Math.max(0, (monster.currentHealth / monster.maxHealth) * 100) : 0;
    const zone = zones.find((z) => z.id === character.zoneId);

    return (
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 className="text-gold font-semibold">{zone?.name}</h3>
            <p className="text-xs text-neutral-500">{zone?.region}</p>
          </div>
          <button
            onClick={() => setAutoCombat(false)}
            className="bg-blood text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-red-800 cursor-pointer"
          >
            Parar Combate
          </button>
        </div>

        {isDead && (
          <div className="bg-blood/20 border border-blood rounded p-3 text-center text-sm">
            Você foi derrotado. Espere o HP regenerar ou coma algo, depois clique em "Parar Combate".
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
            <h3 className="text-gold font-semibold mb-2">{character.name} (Nv. {character.level})</h3>
            <div className="h-3 bg-wood rounded overflow-hidden mb-1">
              <div className="h-full bg-blood transition-all" style={{ width: `${hpPct}%` }} />
            </div>
            <p className="text-xs text-neutral-400">
              {Math.max(0, Math.round(character.currentHealth))} / {Math.round(character.stats.health)} HP
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

  return (
    <div className="flex-1">
      <h3 className="text-gold font-semibold tracking-wide mb-3">◆ ZONAS DE CAÇA</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {zones.map((zone) => {
          const locked = character.level < zone.minLevel;
          return (
            <div
              key={zone.id}
              className={`bg-wood-light border rounded-lg p-4 flex flex-col gap-2
                ${locked ? 'border-wood-lighter opacity-50' : 'border-wood-lighter'}`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-neutral-100">
                  {zone.name} {zone.boss && <span className="text-blood text-xs">BOSS</span>}
                </h4>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500 bg-wood px-1.5 py-0.5 rounded">
                  {zone.region}
                </span>
              </div>
              <p className="text-xs text-neutral-400">{zone.description}</p>
              <p className="text-[11px] text-neutral-500">
                {zone.monsters.map((m) => m.name).join(', ')}
              </p>
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs">
                  <span className="text-gold">{zone.xpPerHour.toLocaleString('pt-BR')} xp/h</span>
                  {' · '}
                  <span className="text-green-500">{zone.goldPerHour.toLocaleString('pt-BR')} g/h</span>
                  <span className="text-neutral-600"> · sustentável</span>
                </div>
                <button
                  onClick={() => {
                    if (locked) return;
                    changeZone(zone.id);
                    setAutoCombat(true);
                  }}
                  disabled={locked}
                  className="bg-gold text-wood text-xs font-semibold px-3 py-1.5 rounded
                             disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
                >
                  {locked ? `🔒 nível ${zone.minLevel}` : 'CAÇAR'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
