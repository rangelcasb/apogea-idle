import { ALLOCATABLE_STATS, canAllocatePoint, CLASSES, EQUIP_SLOTS, HAND_CAPACITY, RARITY_COLORS, formatItemStats, computeDamageRoll } from '../data/gameData';
import Mochila from './Mochila';

const VOCATIONS = ['Knight', 'Rogue', 'Mage'];

const STAT_META = {
  health: { label: 'Health', note: '+5 HP/ponto' },
  mana: { label: 'Mana', note: '+5 MP/ponto' },
  magic: { label: 'Magic', note: '+1 ponto' },
  ability: { label: 'Ability', note: '+1 dano min/máx/ponto' },
  hpRegen: { label: 'HP Regen', note: '+1 ponto' },
  mpRegen: { label: 'MP Regen', note: '+1 ponto' },
  capacity: { label: 'Capacity', note: '+25 oz/ponto' },
};

function EquipStats({ stats }) {
  const text = formatItemStats(stats);
  if (!text) return null;
  return <p className="text-xs text-gold">{text}</p>;
}

export default function Personagem({
  character,
  unspentPoints,
  allocateStat,
  resetAttributes,
  respecCost,
  unequipItem,
  weight,
  consumeItem,
  equipItem,
  sellItem,
  discardItem,
  chooseVocation,
  vocationCost,
  autoCombat,
}) {
  const isSquire = character.class === 'Squire';
  const handSize = (character.equipment.weapon?.equipSize ?? 0) + (character.equipment.offhand?.equipSize ?? 0);
  const attackSpeed = character.stats.attackSpeed || 10;
  const interval = 2 / (attackSpeed / 10); // fórmula real: 2s / (AttackSpeed/10)
  const { min: minDamage, max: maxDamage, avg: avgDamage } = computeDamageRoll(character.stats);
  const dps = avgDamage / interval;

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-4 items-start">
      {/* Coluna Atributos + Combate */}
      <div className="flex flex-col gap-4 2xl:col-span-2">
        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold tracking-wide mb-3">◆ ATRIBUTOS</h3>

          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-neutral-500 text-xs">
                <th className="text-left font-normal pb-1">Atributo</th>
                <th className="text-right font-normal pb-1">Pontos</th>
                <th className="text-right font-normal pb-1">Valor Final</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ALLOCATABLE_STATS.map((stat) => {
                const meta = STAT_META[stat];
                const pts = character.levelBatches.reduce((sum, b) => sum + (b.spent[stat] ?? 0), 0);
                const canOne = unspentPoints > 0 && canAllocatePoint(character.levelBatches, stat);
                return (
                  <tr key={stat} className="border-t border-wood-lighter">
                    <td className="py-1.5">
                      <p className="text-neutral-200">{meta.label}</p>
                      <p className="text-[10px] text-neutral-500">{meta.note}</p>
                    </td>
                    <td className="text-right text-neutral-300">{pts}</td>
                    <td className="text-right text-gold font-medium">
                      {Math.round(character.stats[stat] * 100) / 100}
                    </td>
                    <td className="text-right pl-2">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => allocateStat(stat)}
                          disabled={!canOne}
                          className="text-xs bg-wood border border-wood-lighter rounded px-1.5 py-0.5
                                     disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-gold"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => {
                            for (let i = 0; i < 5; i++) allocateStat(stat);
                          }}
                          disabled={!canOne}
                          className="text-xs bg-wood border border-wood-lighter rounded px-1.5 py-0.5
                                     disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-gold"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="text-[11px] text-neutral-500 mb-3">
            Você ganha 3 pontos por nível ((nível-1)×3). No máximo 2 pontos de cada nível
            podem ir pro mesmo atributo — o restante vai para outro. Multiplicadores de
            classe aplicam sobre os pontos.
          </p>

          <button
            onClick={resetAttributes}
            disabled={character.gold < respecCost || character.levelBatches.length === 0}
            className="w-full text-xs font-medium bg-wood border border-wood-lighter rounded py-1.5
                       disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-blood hover:text-blood"
          >
            RESETAR ATRIBUTOS ({respecCost}G)
          </button>
        </div>

        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold tracking-wide mb-3">◆ COMBATE</h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="text-neutral-500">Dano por golpe</p>
              <p className="text-neutral-100 font-medium">{minDamage.toFixed(1)}-{maxDamage.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Intervalo</p>
              <p className="text-neutral-100 font-medium">{interval.toFixed(2)}s</p>
            </div>
            <div>
              <p className="text-neutral-500">DPS</p>
              <p className="text-neutral-100 font-medium">{dps.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Armor / Defense</p>
              <p className="text-neutral-100 font-medium">
                {character.stats.armor.toFixed(1)} / {character.stats.defense.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Damage (stat)</p>
              <p className="text-neutral-100 font-medium">{character.stats.damage.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Attack Speed</p>
              <p className="text-neutral-100 font-medium">{attackSpeed.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-neutral-500">HP Regen / 10s</p>
              <p className="text-green-500 font-medium">+{character.stats.hpRegen.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-neutral-500">MP Regen / 10s</p>
              <p className="text-blue-400 font-medium">+{character.stats.mpRegen.toFixed(1)}</p>
            </div>
          </div>

          {(character.stats.lifestealPercent > 0 || character.stats.critChance > 0 || character.stats.armorPenPercent > 0) && (
            <div className="grid grid-cols-3 gap-3 text-center text-xs mt-3 pt-3 border-t border-wood-lighter">
              {character.stats.lifestealPercent > 0 && (
                <div>
                  <p className="text-neutral-500">Lifesteal</p>
                  <p className="text-blood font-medium">{character.stats.lifestealPercent.toFixed(1)}%</p>
                </div>
              )}
              {character.stats.critChance > 0 && (
                <div>
                  <p className="text-neutral-500">Chance Crítico</p>
                  <p className="text-purple-400 font-medium">
                    {(character.stats.critChance * 100).toFixed(1)}% ×{character.stats.critMultiplier}
                  </p>
                </div>
              )}
              {character.stats.armorPenPercent > 0 && (
                <div>
                  <p className="text-neutral-500">Penetração Armor</p>
                  <p className="text-neutral-100 font-medium">{character.stats.armorPenPercent.toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Coluna Equipamento */}
      <div className="flex flex-col gap-4">
        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold tracking-wide mb-3">
            ◆ EQUIPAMENTO — MÃOS: {handSize}/{HAND_CAPACITY}
          </h3>
          <div className="flex flex-col gap-2">
            {Object.entries(EQUIP_SLOTS).map(([slot, label]) => {
              const item = character.equipment[slot];
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-3 py-2"
                >
                  <div>
                    <p className="text-[10px] text-neutral-500">{label}</p>
                    {item ? (
                      <>
                        <p className={`text-sm ${RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}`}>{item.name}</p>
                        <EquipStats stats={item.stats} />
                      </>
                    ) : (
                      <p className="text-sm text-neutral-600">vazio</p>
                    )}
                  </div>
                  {item && (
                    <button
                      onClick={() => unequipItem(slot)}
                      className="text-xs font-medium bg-wood-lighter px-2.5 py-1 rounded cursor-pointer hover:text-blood"
                    >
                      TIRAR
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coluna Mochila */}
      <Mochila
        character={character}
        weight={weight}
        consumeItem={consumeItem}
        equipItem={equipItem}
        sellItem={sellItem}
        discardItem={discardItem}
        autoCombat={autoCombat}
      />

      {/* Coluna Vocação (5ª coluna) — se retrai a um resumo curto depois de escolhida */}
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        {isSquire ? (
          <>
            <h3 className="text-gold font-semibold tracking-wide mb-2">◆ VOCAÇÃO — ESCOLHA A SUA</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Você é Squire, sem vocação (todos os multiplicadores neutros). Pague{' '}
              {vocationCost}g pra escolher — é definitivo, não dá pra trocar depois.
            </p>
            <div className="flex flex-col gap-2">
              {VOCATIONS.map((name) => {
                const cls = CLASSES[name];
                const canAfford = character.gold >= vocationCost;
                return (
                  <div key={name} className="flex flex-col gap-2 bg-wood border border-wood-lighter rounded px-3 py-2">
                    <div>
                      <p className="text-sm text-neutral-200">{cls.name}</p>
                      <p className="text-[10px] text-neutral-500">{cls.description}</p>
                    </div>
                    <button
                      onClick={() => chooseVocation(name)}
                      disabled={!canAfford}
                      className="text-xs font-medium bg-gold text-wood px-3 py-1.5 rounded
                                 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
                    >
                      ESCOLHER ({vocationCost}G)
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-gold font-semibold tracking-wide mb-1">◆ VOCAÇÃO</h3>
            <p className="text-sm text-neutral-100">{character.class}</p>
            <p className="text-[10px] text-neutral-500">🔒 Definitiva</p>
          </>
        )}
      </div>
    </div>
  );
}
