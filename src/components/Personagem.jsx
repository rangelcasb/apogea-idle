import { ALLOCATABLE_STATS, canAllocatePoint, CLASSES, EQUIP_SLOTS, HAND_CAPACITY, RARITY_COLORS, formatItemStats, computeDamageRoll } from '../data/gameData';
import Mochila from './Mochila';
import ItemIcon from './ItemIcon';

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
  addToBlacklist,
  setAutoEatDrops,
  setAutoEatCookedInventory,
  resetSatiety,
  setAutoPotion,
  learnSpell,
}) {
  const isSquire = character.class === 'Squire';
  const handSize = (character.equipment.weapon?.equipSize ?? 0) + (character.equipment.offhand?.equipSize ?? 0);
  const attackSpeed = character.stats.attackSpeed || 10;
  const interval = 2 / (attackSpeed / 10); // fórmula real: 2s / (AttackSpeed/10)
  const { min: minDamage, max: maxDamage, avg: avgDamage } = computeDamageRoll(character.stats);
  const dps = avgDamage / interval;

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {/* Coluna Atributos + Combate + Vocação */}
      <div className="flex flex-col gap-4">
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
            <div>
              <p className="text-neutral-500">Movespeed</p>
              <p className="text-neutral-100 font-medium">{(character.stats.movespeed ?? 10).toFixed(1)}</p>
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

        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 flex flex-col gap-3">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>
              <span className="text-gold font-semibold tracking-wide">◆ COMER DROP AUTOMÁTICO</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Come na hora qualquer comida que dropar de monstro morto (não mexe em comida
                comprada na loja, que sempre vai pra mochila).
              </p>
            </span>
            <input
              type="checkbox"
              checked={character.autoEatDrops ?? false}
              onChange={(e) => setAutoEatDrops(e.target.checked)}
              className="shrink-0 w-5 h-5 accent-gold cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer border-t border-wood-lighter pt-3">
            <span>
              <span className="text-gold font-semibold tracking-wide">◆ COMER PRATO PRONTO DA MOCHILA</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Quando a saciedade zerar, come sozinho o prato pronto (comida preparada, com
                regen de verdade) que estiver guardado na mochila. Ingrediente cru e bebida não
                entram aqui, já que não dão regen.
              </p>
            </span>
            <input
              type="checkbox"
              checked={character.autoEatCookedInventory ?? false}
              onChange={(e) => setAutoEatCookedInventory(e.target.checked)}
              className="shrink-0 w-5 h-5 accent-gold cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between gap-2 border-t border-wood-lighter pt-3">
            <span>
              <span className="text-gold font-semibold tracking-wide">◆ SACIEDADE</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {character.satiety?.remainingMs > 0
                  ? `Saciado (${character.satiety.foodName}) por mais ${Math.ceil(character.satiety.remainingMs / 60000)}min.`
                  : 'Sem saciedade ativa no momento.'}
              </p>
            </span>
            <button
              onClick={resetSatiety}
              disabled={!(character.satiety?.remainingMs > 0)}
              className="shrink-0 text-xs font-medium bg-wood border border-wood-lighter rounded px-3 py-1.5
                         disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-blood hover:text-blood"
            >
              ZERAR
            </button>
          </div>
        </div>

        <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
          <label className="flex items-center justify-between gap-2 cursor-pointer mb-2">
            <span>
              <span className="text-gold font-semibold tracking-wide">◆ POÇÃO AUTOMÁTICA</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Usa a maior poção de vida/mana disponível na mochila assim que vida ou mana
                caírem pra igual ou abaixo da % que você definir.
              </p>
            </span>
            <input
              type="checkbox"
              checked={character.autoPotion?.enabled ?? false}
              onChange={(e) => setAutoPotion({ enabled: e.target.checked })}
              className="shrink-0 w-5 h-5 accent-gold cursor-pointer"
            />
          </label>
          <div className="flex gap-4 text-xs text-neutral-300">
            <label className="flex items-center gap-1.5">
              Vida ≤
              <input
                type="number"
                min={1}
                max={99}
                value={character.autoPotion?.healthPct ?? 30}
                onChange={(e) => setAutoPotion({ healthPct: Math.min(99, Math.max(1, Number(e.target.value) || 0)) })}
                className="w-14 bg-wood border border-wood-lighter rounded px-1.5 py-1 text-neutral-100 focus:outline-none focus:border-gold"
              />
              %
            </label>
            <label className="flex items-center gap-1.5">
              Mana ≤
              <input
                type="number"
                min={1}
                max={99}
                value={character.autoPotion?.manaPct ?? 30}
                onChange={(e) => setAutoPotion({ manaPct: Math.min(99, Math.max(1, Number(e.target.value) || 0)) })}
                className="w-14 bg-wood border border-wood-lighter rounded px-1.5 py-1 text-neutral-100 focus:outline-none focus:border-gold"
              />
              %
            </label>
          </div>
        </div>

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
                    <div key={name} className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-3 py-2">
                      <div>
                        <p className="text-sm text-neutral-200">{cls.name}</p>
                        <p className="text-[10px] text-neutral-500">{cls.description}</p>
                      </div>
                      <button
                        onClick={() => chooseVocation(name)}
                        disabled={!canAfford}
                        className="text-xs font-medium bg-gold text-wood px-3 py-1.5 rounded shrink-0 ml-2
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
                  <div className="flex items-center gap-2 min-w-0">
                    {item && <ItemIcon name={item.name} />}
                    <div className="min-w-0">
                      <p className="text-[10px] text-neutral-500">{label}</p>
                      {item ? (
                        <>
                          <p className={`text-sm truncate ${RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}`}>{item.name}</p>
                          <EquipStats stats={item.stats} />
                        </>
                      ) : (
                        <p className="text-sm text-neutral-600">vazio</p>
                      )}
                    </div>
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

      {/* Coluna Mochila (ocupa 2 das 4 colunas — precisa de mais espaço pros cards) */}
      <div className="xl:col-span-2">
        <Mochila
          character={character}
          weight={weight}
          consumeItem={consumeItem}
          equipItem={equipItem}
          sellItem={sellItem}
          discardItem={discardItem}
          autoCombat={autoCombat}
          addToBlacklist={addToBlacklist}
          learnSpell={learnSpell}
          learnedSpells={character.learnedSpells}
        />
      </div>
    </div>
  );
}
