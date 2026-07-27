import { useState, useMemo } from 'react';
import { ALL_MONSTERS, BESTIARY_STAR_THRESHOLDS, monsterStars, BESTIARY_DAMAGE_PER_STAR } from '../data/gameData';

function Stars({ count, max }) {
  return (
    <span className="text-xs tracking-wide">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < count ? 'text-gold' : 'text-wood-lighter'}>★</span>
      ))}
    </span>
  );
}

export default function Bestiario({ character }) {
  const [search, setSearch] = useState('');
  const monsters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? ALL_MONSTERS.filter((m) => m.name.toLowerCase().includes(q)) : ALL_MONSTERS;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [search]);
  const maxStars = BESTIARY_STAR_THRESHOLDS.length;

  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ BESTIÁRIO</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          A cada {BESTIARY_STAR_THRESHOLDS.join('/')} abates numa criatura, você ganha 1 estrela e
          +{BESTIARY_DAMAGE_PER_STAR * 100}% de dano contra ela (só contra ela).
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar criatura por nome..."
          className="w-full max-w-xs bg-wood border border-wood-lighter rounded px-3 py-1.5 text-sm
                     text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-gold"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {monsters.map((monster) => {
          const kills = character.monsterKills?.[monster.name] ?? 0;
          const stars = monsterStars(kills);
          const nextThreshold = BESTIARY_STAR_THRESHOLDS.find((t) => kills < t);
          return (
            <div
              key={monster.name}
              className={`bg-wood-light border rounded-lg p-3 flex flex-col gap-1
                ${stars > 0 ? 'border-gold/40' : 'border-wood-lighter'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-neutral-100 truncate">{monster.name}</p>
                <Stars count={stars} max={maxStars} />
              </div>
              <p className="text-[10px] text-neutral-500">
                {kills.toLocaleString('pt-BR')} abates
                {nextThreshold && ` · faltam ${(nextThreshold - kills).toLocaleString('pt-BR')} pra próxima estrela`}
              </p>
              {stars > 0 && (
                <p className="text-[10px] text-gold">+{stars * BESTIARY_DAMAGE_PER_STAR * 100}% de dano nessa criatura</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
