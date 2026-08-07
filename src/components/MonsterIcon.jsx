import { useState } from 'react';
import { getMonsterImageUrl } from '../data/monsterImages';
import { DROP_CHANCE } from '../data/gameData';
import { CUSTOM_MONSTER_SVG } from './monsterIconsSvg';

// Mesmo esquema do ItemIcon: ícone real (apogea-tools.lubien.dev) quando existe;
// pros 24 monstros adicionados depois (sem arte oficial disponível em nenhuma das
// fontes que usamos), cai num SVG simples próprio (ver monsterIconsSvg.jsx); só cai
// no emoji genérico se nem isso existir.
function Icon({ name, className }) {
  const url = getMonsterImageUrl(name);
  const [failed, setFailed] = useState(false);
  const CustomSvg = CUSTOM_MONSTER_SVG[name];

  if ((!url || failed) && CustomSvg) {
    return (
      <span className={`${className} shrink-0 inline-block`}>
        <CustomSvg />
      </span>
    );
  }
  if (!url || failed) {
    return <span className={`${className} flex items-center justify-center text-neutral-600 shrink-0`}>👹</span>;
  }
  return <img src={url} alt={name} className={`${className} shrink-0 object-contain`} onError={() => setFailed(true)} />;
}

// Ao passar o mouse, mostra HP/dano/armadura/XP do monstro e a tabela de loot com a
// chance de cada item cair — DROP_CHANCE é a mesma % usada de verdade no sorteio de
// loot (ver lootTables.js), então o que aparece aqui bate com o jogo.
export default function MonsterIcon({ monster, className = 'w-10 h-10' }) {
  const [hover, setHover] = useState(false);
  const loot = monster.loot ?? [];

  return (
    <div className="relative inline-block" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Icon name={monster.name} className={className} />
      {hover && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-wood border border-gold rounded-lg p-3 shadow-lg text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold mb-1">
            <Icon name={monster.name} className="w-5 h-5" />
            {monster.name}
          </p>
          <p className="text-[11px] text-neutral-300">❤️ {monster.health} HP</p>
          <p className="text-[11px] text-neutral-300">✨ {monster.xp} XP</p>
          <p className="text-[11px] text-neutral-300">⚔️ dano {monster.damage}</p>
          <p className="text-[11px] text-neutral-300">🛡️ armadura {monster.armor}</p>

          {loot.length > 0 && (
            <>
              <p className="text-[10px] text-neutral-500 mt-2 mb-1 tracking-wide">LOOT</p>
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {loot.map((drop) => (
                  <div key={drop.name} className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-300 truncate pr-2">{drop.name}</span>
                    <span className="text-gold shrink-0">{(DROP_CHANCE[drop.rarity] * 100).toString()}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
