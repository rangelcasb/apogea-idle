import { ITEM_TYPES, RARITY_COLORS, RARITY_LABELS, FOOD_CATEGORIES, formatItemStats } from '../data/gameData';

const TYPE_LABELS = {
  [ITEM_TYPES.WEAPON]: 'Weapons',
  [ITEM_TYPES.ARMOR]: 'Armor',
  [ITEM_TYPES.CONSUMABLE]: 'Food',
  [ITEM_TYPES.MATERIAL]: 'Materials',
};

export default function Mochila({ character, weight, consumeItem, equipItem, sellItem, discardItem }) {
  return (
    <div className="flex-1 bg-wood-light border border-wood-lighter rounded-lg p-4">
      <h3 className="text-gold font-semibold tracking-wide mb-3">
        ◆ MOCHILA — {Math.round(weight)}/{Math.round(character.stats.capacity)} OZ
      </h3>

      {character.inventory.length === 0 ? (
        <p className="text-sm text-neutral-400">Mochila vazia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-500 text-xs border-b border-wood-lighter">
                <th className="text-left font-normal py-2">Item</th>
                <th className="text-right font-normal py-2">Qtd</th>
                <th className="text-left font-normal py-2 pl-4">Categoria</th>
                <th className="text-right font-normal py-2">Venda</th>
                <th className="text-right font-normal py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {character.inventory.map((item) => (
                <tr key={item.id} className="border-b border-wood-lighter last:border-b-0">
                  <td className="py-2">
                    <p className={RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}>
                      {item.name}
                      {item.rarity && item.rarity !== 'common' && (
                        <span className="text-[10px] ml-1">({RARITY_LABELS[item.rarity]})</span>
                      )}
                    </p>
                    {item.stats && (
                      <p className="text-[10px] text-gold">{formatItemStats(item.stats)}</p>
                    )}
                  </td>
                  <td className="text-right text-neutral-300">{item.quantity}</td>
                  <td className="pl-4 text-neutral-400">{item.category ?? TYPE_LABELS[item.type] ?? item.type}</td>
                  <td className="text-right text-gold">{item.sellPrice ?? 0}g</td>
                  <td>
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      {item.type === ITEM_TYPES.CONSUMABLE && (item.stats || FOOD_CATEGORIES.has(item.category)) && (
                        <button
                          onClick={() => consumeItem(item.id)}
                          className="text-xs font-medium bg-gold text-wood px-2 py-1 rounded cursor-pointer hover:bg-yellow-500"
                        >
                          {item.stats ? 'USAR' : 'COMER'}
                        </button>
                      )}
                      {item.slot === 'weapon' ? (
                        <>
                          <button
                            onClick={() => equipItem(item.id, 'weapon')}
                            className="text-xs font-medium bg-green-700 text-white px-2 py-1 rounded cursor-pointer hover:bg-green-600"
                          >
                            MÃO PRINCIPAL
                          </button>
                          <button
                            onClick={() => equipItem(item.id, 'offhand')}
                            className="text-xs font-medium bg-green-700 text-white px-2 py-1 rounded cursor-pointer hover:bg-green-600"
                          >
                            MÃO SECUNDÁRIA
                          </button>
                        </>
                      ) : item.slot && (
                        <button
                          onClick={() => equipItem(item.id)}
                          className="text-xs font-medium bg-green-700 text-white px-2 py-1 rounded cursor-pointer hover:bg-green-600"
                        >
                          EQUIPAR
                        </button>
                      )}
                      <button
                        onClick={() => sellItem(item.id, false)}
                        className="text-xs font-medium bg-wood border border-wood-lighter px-2 py-1 rounded cursor-pointer hover:border-gold"
                      >
                        VENDER 1
                      </button>
                      {item.quantity > 1 && (
                        <button
                          onClick={() => sellItem(item.id, true)}
                          className="text-xs font-medium bg-wood border border-wood-lighter px-2 py-1 rounded cursor-pointer hover:border-gold"
                        >
                          TUDO
                        </button>
                      )}
                      <button
                        onClick={() => discardItem(item.id)}
                        className="text-xs font-medium bg-wood border border-wood-lighter px-2 py-1 rounded cursor-pointer hover:border-blood hover:text-blood"
                      >
                        DESCARTAR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-neutral-500 mt-3">
        💡 Preço de venda estimado (o jogo real não expõe os preços de NPC publicamente).
      </p>
    </div>
  );
}
