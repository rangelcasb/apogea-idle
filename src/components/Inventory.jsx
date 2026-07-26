import { ITEM_TYPES } from '../data/gameData';

const TYPE_LABELS = {
  [ITEM_TYPES.WEAPON]: 'Arma',
  [ITEM_TYPES.ARMOR]: 'Armadura',
  [ITEM_TYPES.CONSUMABLE]: 'Consumível',
  [ITEM_TYPES.MATERIAL]: 'Material',
};

export default function Inventory({ character, consumeItem }) {
  return (
    <div className="p-4">
      <h2 className="text-gold font-semibold text-lg mb-3">
        Inventário ({character.inventory.length} / {character.stats.capacity})
      </h2>

      {character.inventory.length === 0 ? (
        <p className="text-sm text-neutral-400">Inventário vazio.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {character.inventory.map((item) => (
            <div
              key={item.id}
              className="bg-wood-light border border-wood-lighter rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-neutral-100">{item.name}</p>
                <p className="text-xs text-neutral-400">
                  {TYPE_LABELS[item.type] ?? item.type} · x{item.quantity}
                </p>
              </div>
              {item.type === ITEM_TYPES.CONSUMABLE && (
                <button
                  onClick={() => consumeItem(item.id)}
                  className="bg-gold text-wood text-xs font-medium px-3 py-1 rounded hover:bg-yellow-500 cursor-pointer"
                >
                  Usar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
