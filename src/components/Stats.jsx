import { xpForNextLevel, ALLOCATABLE_STATS, canAllocatePoint } from '../data/gameData';

const STAT_LABELS = {
  health: 'Health',
  mana: 'Mana',
  magic: 'Magic',
  ability: 'Ability',
  hpRegen: 'HP Regen',
  mpRegen: 'MP Regen',
  capacity: 'Capacity',
  attackSpeed: 'Attack Speed',
  armor: 'Armor',
  damage: 'Damage',
};

export default function Stats({ character, unspentPoints, allocateStat }) {
  const needed = xpForNextLevel(character.level);
  const xpPct = Math.min(100, (character.xp / needed) * 100);
  const derivedStats = Object.entries(character.stats).filter(
    ([key]) => !ALLOCATABLE_STATS.includes(key),
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="text-gold font-semibold text-lg">
            {character.class} — Nível {character.level}
          </h2>
          <span className="text-sm text-neutral-400">{character.gold} gold</span>
        </div>
        <div className="h-2 bg-wood rounded overflow-hidden mb-1">
          <div className="h-full bg-gold transition-all" style={{ width: `${xpPct}%` }} />
        </div>
        <p className="text-xs text-neutral-400">
          {character.xp} / {needed} XP
        </p>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-gold font-semibold">Atributos</h3>
          <span className="text-xs text-neutral-400">
            {unspentPoints > 0 ? `${unspentPoints} pontos disponíveis` : 'sem pontos disponíveis'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALLOCATABLE_STATS.map((stat) => {
            const canAllocate = unspentPoints > 0 && canAllocatePoint(character.levelBatches, stat);
            return (
              <div
                key={stat}
                className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-3 py-2"
              >
                <span className="text-sm text-neutral-300">{STAT_LABELS[stat] ?? stat}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gold w-14 text-right">
                    {Math.round(character.stats[stat] * 100) / 100}
                  </span>
                  <button
                    onClick={() => allocateStat(stat)}
                    disabled={!canAllocate}
                    className="text-xs font-medium bg-gold text-wood px-2 py-1 rounded
                               disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
                  >
                    +1
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {derivedStats.map(([key, value]) => (
          <div key={key} className="bg-wood-light border border-wood-lighter rounded-lg p-3 text-center">
            <p className="text-xs text-neutral-400">{STAT_LABELS[key] ?? key}</p>
            <p className="text-lg font-semibold text-gold">
              {typeof value === 'number' ? Math.round(value * 100) / 100 : value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
