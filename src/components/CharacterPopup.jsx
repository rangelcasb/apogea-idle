import {
  ALLOCATABLE_STATS,
  EQUIP_SLOTS,
  EQUIP_GRID_LAYOUT,
  RARITY_BORDER_COLORS,
  RARITY_COLORS,
  computeFinalStats,
  computeDamageRoll,
} from '../data/gameData';
import { TALENT_BRANCHES, TALENTS, spentTalentPoints } from '../data/talents';
import ItemIcon from './ItemIcon';

const STAT_LABELS_PT = {
  health: 'Health',
  mana: 'Mana',
  magic: 'Magic',
  ability: 'Ability',
  hpRegen: 'HP Regen',
  mpRegen: 'MP Regen',
  capacity: 'Capacity',
};

// Ficha de personagem somente leitura — usada no popup do Ranking pra dar uma olhada
// nos pontos de atributo, talentos e equipamento de qualquer conta, sem poder mexer
// em nada (sem botões de vender/equipar/alocar, isso é só do próprio personagem).
export default function CharacterPopup({ character, onClose }) {
  const stats = computeFinalStats(character);
  const { min: minDamage, max: maxDamage } = computeDamageRoll(stats);
  const talentPoints = character.talentPoints ?? {};
  const branches = Object.keys(TALENT_BRANCHES).filter((b) => b !== 'core');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-wood border border-gold rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gold font-semibold text-lg">{character.name}</h3>
            <p className="text-xs text-neutral-400">{character.class} · nível {character.level}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-blood text-xl leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Atributos */}
          <div className="bg-wood-light border border-wood-lighter rounded-lg p-3">
            <h4 className="text-gold text-sm font-semibold mb-2">◆ ATRIBUTOS</h4>
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              {ALLOCATABLE_STATS.map((stat) => (
                <div key={stat} className="contents">
                  <dt className="text-neutral-400">{STAT_LABELS_PT[stat]}</dt>
                  <dd className="text-right text-gold">{Math.round(stats[stat] * 100) / 100}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-y-1 text-xs mt-2 pt-2 border-t border-wood-lighter">
              <dt className="text-neutral-400">Dano por golpe</dt>
              <dd className="text-right text-neutral-100">{minDamage.toFixed(1)}-{maxDamage.toFixed(1)}</dd>
              <dt className="text-neutral-400">Attack Speed</dt>
              <dd className="text-right text-neutral-100">{stats.attackSpeed.toFixed(1)}</dd>
              <dt className="text-neutral-400">Armor / Defense</dt>
              <dd className="text-right text-neutral-100">{stats.armor.toFixed(1)} / {stats.defense.toFixed(1)}</dd>
            </div>
          </div>

          {/* Equipamento */}
          <div className="bg-wood-light border border-wood-lighter rounded-lg p-3">
            <h4 className="text-gold text-sm font-semibold mb-2">◆ EQUIPAMENTO</h4>
            <div className="grid grid-cols-3 gap-2">
              {EQUIP_GRID_LAYOUT.map((slot, i) => {
                const item = character.equipment?.[slot];
                const borderClass = item ? (RARITY_BORDER_COLORS[item.rarity] ?? 'border-wood-lighter') : 'border-wood-lighter';
                const isLast = i === EQUIP_GRID_LAYOUT.length - 1;
                return (
                  <div
                    key={slot}
                    title={item ? item.name : EQUIP_SLOTS[slot]}
                    className={`bg-wood border-2 ${borderClass} rounded flex items-center justify-center aspect-square ${isLast ? 'col-start-2' : ''}`}
                  >
                    {item ? <ItemIcon name={item.name} className="w-7 h-7" /> : <span className="text-neutral-700 text-xs">·</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Talentos */}
        <div className="bg-wood-light border border-wood-lighter rounded-lg p-3 mt-4">
          <h4 className="text-gold text-sm font-semibold mb-2">
            ◆ TALENTOS — {spentTalentPoints(talentPoints)} pontos investidos
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {branches.map((branch) => {
              const branchTalentIds = TALENTS.filter((t) => t.branch === branch).map((t) => t.id);
              const pointsInBranch = branchTalentIds.reduce((sum, id) => sum + (talentPoints[id] ?? 0), 0);
              if (pointsInBranch === 0) return null;
              return (
                <div key={branch} className="bg-wood border border-wood-lighter rounded px-2.5 py-1.5">
                  <p className="text-xs text-neutral-200">{TALENT_BRANCHES[branch]}</p>
                  <p className="text-[11px] text-gold">{pointsInBranch} pontos</p>
                </div>
              );
            })}
            {spentTalentPoints(talentPoints) === 0 && (
              <p className="text-xs text-neutral-500 col-span-full">Nenhum talento investido.</p>
            )}
          </div>
        </div>

        {/* Mochila (resumo) */}
        {character.inventory?.length > 0 && (
          <div className="bg-wood-light border border-wood-lighter rounded-lg p-3 mt-4">
            <h4 className="text-gold text-sm font-semibold mb-2">◆ MOCHILA</h4>
            <div className="flex flex-wrap gap-1.5">
              {character.inventory.map((item) => (
                <span
                  key={item.id}
                  title={`${item.name} x${item.quantity}`}
                  className={`flex items-center gap-1 bg-wood border border-wood-lighter rounded px-1.5 py-1 text-[10px] ${RARITY_COLORS[item.rarity] ?? 'text-neutral-300'}`}
                >
                  <ItemIcon name={item.name} className="w-4 h-4" />
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
