import { ITEM_TYPES, RARITY_COLORS, RARITY_LABELS, FOOD_CATEGORIES, formatItemStats } from '../data/gameData';

const TYPE_LABELS = {
  [ITEM_TYPES.WEAPON]: 'Weapons',
  [ITEM_TYPES.ARMOR]: 'Armor',
  [ITEM_TYPES.CONSUMABLE]: 'Food',
  [ITEM_TYPES.MATERIAL]: 'Materials',
};

function ItemCard({ item, consumeItem, equipItem, sellItem, discardItem }) {
  return (
    <div className="bg-wood border border-wood-lighter rounded-lg p-2.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-sm leading-tight ${RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}`}>
          {item.name}
          {item.rarity && item.rarity !== 'common' && (
            <span className="text-[10px] ml-1">({RARITY_LABELS[item.rarity]})</span>
          )}
        </p>
        <span className="text-xs text-neutral-400 shrink-0">×{item.quantity}</span>
      </div>

      {item.stats && <p className="text-[10px] text-gold">{formatItemStats(item.stats)}</p>}

      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>{item.category ?? TYPE_LABELS[item.type] ?? item.type}</span>
        <span className="text-gold">{item.sellPrice ?? 0}g</span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {item.type === ITEM_TYPES.CONSUMABLE && (item.stats || FOOD_CATEGORIES.has(item.category)) && (
          <button
            onClick={() => consumeItem(item.id)}
            className="text-[10px] font-medium bg-gold text-wood px-1.5 py-1 rounded cursor-pointer hover:bg-yellow-500"
          >
            {item.stats ? 'USAR' : 'COMER'}
          </button>
        )}
        {item.slot === 'weapon' ? (
          <>
            <button
              onClick={() => equipItem(item.id, 'weapon')}
              className="text-[10px] font-medium bg-green-700 text-white px-1.5 py-1 rounded cursor-pointer hover:bg-green-600"
            >
              MÃO PRINCIPAL
            </button>
            <button
              onClick={() => equipItem(item.id, 'offhand')}
              className="text-[10px] font-medium bg-green-700 text-white px-1.5 py-1 rounded cursor-pointer hover:bg-green-600"
            >
              MÃO SECUNDÁRIA
            </button>
          </>
        ) : item.slot && (
          <button
            onClick={() => equipItem(item.id)}
            className="text-[10px] font-medium bg-green-700 text-white px-1.5 py-1 rounded cursor-pointer hover:bg-green-600"
          >
            EQUIPAR
          </button>
        )}
        <button
          onClick={() => sellItem(item.id, false)}
          className="text-[10px] font-medium bg-wood-light border border-wood-lighter px-1.5 py-1 rounded cursor-pointer hover:border-gold"
        >
          VENDER 1
        </button>
        {item.quantity > 1 && (
          <button
            onClick={() => sellItem(item.id, true)}
            className="text-[10px] font-medium bg-wood-light border border-wood-lighter px-1.5 py-1 rounded cursor-pointer hover:border-gold"
          >
            TUDO
          </button>
        )}
        <button
          onClick={() => discardItem(item.id)}
          className="text-[10px] font-medium bg-wood-light border border-wood-lighter px-1.5 py-1 rounded cursor-pointer hover:border-blood hover:text-blood"
        >
          DESCARTAR
        </button>
      </div>
    </div>
  );
}

export default function Mochila({ character, weight, consumeItem, equipItem, sellItem, discardItem }) {
  return (
    <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
      <h3 className="text-gold font-semibold tracking-wide mb-3">
        ◆ MOCHILA — {Math.round(weight)}/{Math.round(character.stats.capacity)} OZ
      </h3>

      {character.inventory.length === 0 ? (
        <p className="text-sm text-neutral-400">Mochila vazia.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {character.inventory.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              consumeItem={consumeItem}
              equipItem={equipItem}
              sellItem={sellItem}
              discardItem={discardItem}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-neutral-500 mt-3">
        💡 Preço de venda estimado (o jogo real não expõe os preços de NPC publicamente).
      </p>
    </div>
  );
}
