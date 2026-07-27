import { useEffect, useRef, useState } from 'react';
import { EQUIP_SLOTS } from '../data/gameData';
import MonsterIcon from './MonsterIcon';
import ItemIcon from './ItemIcon';

// Fundo real enviado pelo usuário (screenshot do jogo) — fica atrás de um véu escuro
// pra garantir contraste das barras de vida/texto por cima.
const COMBAT_BG_URL = '/assets/apogea-bg.png';
const AVATAR_URL = '/assets/avatar.svg';

const PLAYER_DAMAGE_RE = /^Você causou ([\d.]+) de dano em .+?\./;
const MONSTER_DAMAGE_RE = /^.+? causou ([\d.]+) de dano em você\./;
const LIFESTEAL_RE = /^Lifesteal: \+([\d.]+) de vida\./;
const KILL_XP_RE = /derrotado! \+(\d+) XP/;
const GOLD_RE = /^\+(\d+) gold\./;

// Observa o log e devolve um "contador de tremida" pra cada lado — cada vez que o
// personagem ou o monstro leva um hit, o contador sobe, o que remonta o ícone (via
// key) e reinicia a animação de tremida do zero.
function useAttackShake(log) {
  const [playerHitId, setPlayerHitId] = useState(0);
  const [monsterHitId, setMonsterHitId] = useState(0);
  const lastId = useRef(null);

  useEffect(() => {
    const latest = log[0];
    if (!latest || latest.id === lastId.current) return;
    lastId.current = latest.id;

    if (PLAYER_DAMAGE_RE.test(latest.message)) {
      setMonsterHitId((n) => n + 1);
    } else if (MONSTER_DAMAGE_RE.test(latest.message)) {
      setPlayerHitId((n) => n + 1);
    }
  }, [log]);

  return { playerHitId, monsterHitId };
}

// Como o próximo monstro já vem pronto no state assim que o anterior morre, não tem
// uma "janela" natural pra tocar saída+entrada — aqui a gente segura o monstro
// anterior na tela por uma fração de segundo tocando a saída, e só troca pelo novo
// depois, tocando a entrada.
function useMonsterTransition(monster, kills) {
  const [displayed, setDisplayed] = useState(monster);
  const [phase, setPhase] = useState('idle');
  const prevKills = useRef(kills);

  useEffect(() => {
    if (kills !== prevKills.current) {
      prevKills.current = kills;
      setPhase('exiting');
      const t1 = setTimeout(() => {
        setDisplayed(monster);
        setPhase('entering');
        const t2 = setTimeout(() => setPhase('idle'), 350);
        return () => clearTimeout(t2);
      }, 250);
      return () => clearTimeout(t1);
    }
    setDisplayed(monster);
  }, [monster, kills]);

  return { displayed, phase };
}

// Lê a última mensagem do log e transforma em um número flutuante (dano, XP, gold,
// lifesteal) que sobe e desaparece — sem precisar mudar o reducer, só observando o
// log que ele já produz.
function useFloatingNumbers(log) {
  const [floaters, setFloaters] = useState([]);
  const lastId = useRef(null);

  useEffect(() => {
    const latest = log[0];
    if (!latest || latest.id === lastId.current) return;
    lastId.current = latest.id;

    let floater = null;
    let m;
    if ((m = PLAYER_DAMAGE_RE.exec(latest.message))) {
      floater = { side: 'monster', text: `-${m[1]}`, color: 'text-neutral-100' };
    } else if ((m = MONSTER_DAMAGE_RE.exec(latest.message))) {
      floater = { side: 'player', text: `-${m[1]}`, color: 'text-blood' };
    } else if ((m = LIFESTEAL_RE.exec(latest.message))) {
      floater = { side: 'player', text: `+${m[1]}`, color: 'text-green-400' };
    } else if ((m = KILL_XP_RE.exec(latest.message))) {
      floater = { side: 'player', text: `+${m[1]} XP`, color: 'text-gold' };
    } else if ((m = GOLD_RE.exec(latest.message))) {
      floater = { side: 'player', text: `+${m[1]}g`, color: 'text-gold' };
    }
    if (!floater) return;

    const id = latest.id;
    setFloaters((prev) => [...prev, { id, ...floater }]);
    const timer = setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1100);
    return () => clearTimeout(timer);
  }, [log]);

  return floaters;
}

function Floaters({ floaters, side }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible">
      {floaters
        .filter((f) => f.side === side)
        .map((f) => (
          <span
            key={f.id}
            className={`absolute top-1/3 text-lg font-bold drop-shadow ${f.color} animate-float-up`}
          >
            {f.text}
          </span>
        ))}
    </div>
  );
}

export default function Cacada({ character, monster, log, autoCombat, setAutoCombat, zones, changeZone }) {
  const isDead = character.currentHealth <= 0;
  const floaters = useFloatingNumbers(log);
  const { playerHitId, monsterHitId } = useAttackShake(log);
  const { displayed: displayedMonster, phase: monsterPhase } = useMonsterTransition(monster, character.kills);

  // Enquanto está caçando (combate automático ligado), mostra o painel de combate ao
  // vivo. Fora de combate, mostra a grade de zonas — igual à tela "Zonas de Caça".
  if (autoCombat) {
    const hpPct = Math.max(0, (character.currentHealth / character.stats.health) * 100);
    const mpPct = Math.max(0, (character.currentMana / character.stats.mana) * 100);
    const monsterHpPct = displayedMonster
      ? Math.max(0, (displayedMonster.currentHealth / displayedMonster.maxHealth) * 100)
      : 0;
    const zone = zones.find((z) => z.id === character.zoneId);
    const avgMonsterXp = zone?.monsters.length
      ? zone.monsters.reduce((sum, m) => sum + m.xp, 0) / zone.monsters.length
      : 0;
    const killsPerHour = avgMonsterXp > 0 ? Math.round(zone.xpPerHour / avgMonsterXp) : 0;

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

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Grade de equipamento */}
          <div className="bg-wood-light border border-wood-lighter rounded-lg p-3 grid grid-cols-3 gap-2 content-start shrink-0 sm:w-40">
            {Object.entries(EQUIP_SLOTS).map(([slot, label]) => {
              const item = character.equipment[slot];
              return (
                <div
                  key={slot}
                  title={item ? item.name : label}
                  className="bg-wood border border-wood-lighter rounded flex items-center justify-center aspect-square"
                >
                  {item ? <ItemIcon name={item.name} className="w-7 h-7" /> : <span className="text-neutral-700 text-xs">·</span>}
                </div>
              );
            })}
          </div>

          {/* Cena de combate — sem overflow-hidden: o tooltip do monstro (MonsterIcon)
              precisa poder "vazar" pra fora da cena pra não ficar atrás do log embaixo. */}
          <div
            className="flex-1 relative rounded-lg border border-wood-lighter min-h-[220px] bg-cover bg-center"
            style={{ backgroundImage: `url(${COMBAT_BG_URL})` }}
          >
            <div className="absolute inset-0 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-black/45" />
            </div>
            <div className="absolute inset-0 flex items-center justify-around px-8">
              <div className="relative flex flex-col items-center gap-1">
                <p className="text-xs font-semibold text-neutral-100 drop-shadow">{character.name}</p>
                <div className="w-24 h-2 bg-black/50 rounded overflow-hidden">
                  <div className="h-full bg-blood transition-all" style={{ width: `${hpPct}%` }} />
                </div>
                <div className="w-24 h-2 bg-black/50 rounded overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${mpPct}%` }} />
                </div>
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <img
                    key={`player-icon-${playerHitId}`}
                    src={AVATAR_URL}
                    alt={character.name}
                    className="w-16 h-16 object-contain drop-shadow-lg animate-shake"
                  />
                  <Floaters floaters={floaters} side="player" />
                </div>
                <p className="text-[10px] text-neutral-200 drop-shadow text-center">
                  {Math.round(character.currentHealth)}/{Math.round(character.stats.health)} HP
                  {' · '}
                  {Math.round(character.currentMana)}/{Math.round(character.stats.mana)} MP
                  <br />
                  <span className="text-green-400">+{character.stats.hpRegen.toFixed(1)} HP</span>
                  {' · '}
                  <span className="text-blue-300">+{character.stats.mpRegen.toFixed(1)} MP</span>
                  <span className="text-neutral-400"> /10s</span>
                </p>
              </div>

              <div className="relative flex flex-col items-center gap-1">
                <p className="text-xs font-semibold text-neutral-100 drop-shadow">
                  {displayedMonster ? displayedMonster.name : '...'}
                </p>
                <div className="w-24 h-2 bg-black/50 rounded overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${monsterHpPct}%` }} />
                </div>
                <div className="relative w-16 h-16 flex items-center justify-center bg-black/20 rounded-full">
                  {displayedMonster && (
                    <div
                      key={`monster-scene-${character.kills}-${monsterPhase}`}
                      className={
                        monsterPhase === 'exiting'
                          ? 'animate-monster-exit'
                          : monsterPhase === 'entering'
                            ? 'animate-monster-enter'
                            : undefined
                      }
                    >
                      <span key={`monster-shake-${monsterHitId}`} className={monsterPhase === 'idle' ? 'animate-shake' : undefined}>
                        <MonsterIcon monster={displayedMonster} className="w-12 h-12" />
                      </span>
                    </div>
                  )}
                  <Floaters floaters={floaters} side="monster" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-wood-light border border-wood-lighter rounded px-2.5 py-1 text-neutral-300">
            {killsPerHour.toLocaleString('pt-BR')} abates/h
          </span>
          <span className="bg-wood-light border border-wood-lighter rounded px-2.5 py-1 text-gold">
            {zone?.xpPerHour.toLocaleString('pt-BR')} xp/h
          </span>
          <span className="bg-wood-light border border-wood-lighter rounded px-2.5 py-1 text-green-500">
            {zone?.goldPerHour.toLocaleString('pt-BR')} gold/h
          </span>
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
              <div className="flex items-center gap-1.5 flex-wrap">
                {zone.monsters.map((m) => (
                  <MonsterIcon key={m.name} monster={m} className="w-8 h-8" />
                ))}
              </div>
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
