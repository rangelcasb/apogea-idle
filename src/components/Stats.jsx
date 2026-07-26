import { xpForNextLevel } from '../data/gameData';

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

export default function Stats({ character }) {
  const needed = xpForNextLevel(character.level);
  const xpPct = Math.min(100, (character.xp / needed) * 100);

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(character.stats).map(([key, value]) => (
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
