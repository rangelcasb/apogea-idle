import { RARITY_COLORS, RARITY_LABELS, formatItemStats, SPELLS } from '../data/gameData';
import ItemIcon from './ItemIcon';

const SPELLS_BY_BOOK = Object.fromEntries(SPELLS.map((s) => [s.book, s]));

function ItemRow({ item, actionLabel, onAction, onActionAll, disabled, learnSpell, learnedSpells }) {
  const spell = item.category === 'book' ? SPELLS_BY_BOOK[item.name] : null;
  const alreadyLearned = spell && (learnedSpells ?? []).includes(spell.id);
  return (
    <div className="bg-wood border border-wood-lighter rounded-lg p-2.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <ItemIcon name={item.name} />
          <p className={`text-sm leading-tight truncate ${RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}`}>
            {item.name}
            {item.rarity && item.rarity !== 'common' && (
              <span className="text-[10px] ml-1">({RARITY_LABELS[item.rarity]})</span>
            )}
          </p>
        </span>
        <span className="text-xs text-neutral-400 shrink-0">×{item.quantity}</span>
      </div>
      {item.stats && <p className="text-[10px] text-gold">{formatItemStats(item.stats)}</p>}
      <div className="flex gap-1 flex-wrap">
        {spell && learnSpell && (
          <button
            onClick={() => learnSpell(spell.id)}
            disabled={alreadyLearned}
            title={alreadyLearned ? 'Você já aprendeu essa magia' : `Aprender ${spell.id} (consome o livro)`}
            className="text-[10px] font-medium bg-green-700 text-white px-1.5 py-1 rounded cursor-pointer
                       hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-green-700"
          >
            {alreadyLearned ? 'JÁ APRENDIDA' : '📖 APRENDER'}
          </button>
        )}
        <button
          onClick={() => onAction(item.id)}
          disabled={disabled}
          className="text-[10px] font-medium bg-gold text-wood px-1.5 py-1 rounded cursor-pointer hover:bg-yellow-500
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {actionLabel} 1
        </button>
        {item.quantity > 1 && (
          <button
            onClick={() => onActionAll(item.id)}
            disabled={disabled}
            className="text-[10px] font-medium bg-wood-light border border-wood-lighter px-1.5 py-1 rounded cursor-pointer
                       hover:border-gold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {actionLabel} TUDO
          </button>
        )}
      </div>
    </div>
  );
}

export default function Banco({ character, weight, depositItem, withdrawItem, autoCombat, learnSpell }) {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">
          ◆ MOCHILA — {Math.round(weight)}/{Math.round(character.stats.capacity)} OZ
        </h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Itens guardados no banco não pesam na mochila e ficam seguros pra sempre.
        </p>
        {autoCombat && (
          <p className="text-[11px] text-blood mb-2">⚔️ Em combate — pare a caçada pra mexer no banco.</p>
        )}
        {character.inventory.length === 0 ? (
          <p className="text-sm text-neutral-400">Mochila vazia.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {character.inventory.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                actionLabel="GUARDAR"
                onAction={(id) => depositItem(id, false)}
                onActionAll={(id) => depositItem(id, true)}
                disabled={autoCombat}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ BANCO</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Retirar um item precisa de espaço livre na mochila (peso/capacidade).
        </p>
        {character.bank.length === 0 ? (
          <p className="text-sm text-neutral-400">Banco vazio.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {character.bank.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                actionLabel="RETIRAR"
                onAction={(id) => withdrawItem(id, false)}
                onActionAll={(id) => withdrawItem(id, true)}
                disabled={autoCombat}
                learnSpell={learnSpell}
                learnedSpells={character.learnedSpells}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
