import { ITEM_TYPES, EQUIP_SLOTS } from '../data/gameData';

const TYPE_LABELS = {
  [ITEM_TYPES.WEAPON]: 'Arma',
  [ITEM_TYPES.ARMOR]: 'Armadura',
  [ITEM_TYPES.CONSUMABLE]: 'Consumível',
  [ITEM_TYPES.MATERIAL]: 'Material',
};

function EquipStats({ stats }) {
  if (!stats) return null;
  return (
    <p className="text-xs text-gold">
      {Object.entries(stats).map(([k, v]) => `${k} +${v}`).join(' · ')}
    </p>
  );
}

export default function Inventory({ character, consumeItem, equipItem, unequipItem }) {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-gold font-semibold text-lg mb-3">Equipamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(EQUIP_SLOTS).map(([slot, label]) => {
            const item = character.equipment[slot];
            return (
              <div
                key={slot}
                className="bg-wood-light border border-wood-lighter rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <p className="text-xs text-neutral-400">{label}</p>
                  {item ? (
                    <>
                      <p className="font-medium text-neutral-100">{item.name}</p>
                      <EquipStats stats={item.stats} />
                    </>
                  ) : (
                    <p className="text-sm text-neutral-500">vazio</p>
                  )}
                </div>
                {item && (
                  <button
                    onClick={() => unequipItem(slot)}
                    className="text-xs text-neutral-400 hover:text-blood cursor-pointer"
                  >
                    Tirar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-gold font-semibold text-lg mb-3">
          Inventário ({character.inventory.length} / {Math.round(character.stats.capacity)} oz)
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
                  <EquipStats stats={item.stats} />
                </div>
                {item.type === ITEM_TYPES.CONSUMABLE && (
                  <button
                    onClick={() => consumeItem(item.id)}
                    className="bg-gold text-wood text-xs font-medium px-3 py-1 rounded hover:bg-yellow-500 cursor-pointer"
                  >
                    Usar
                  </button>
                )}
                {item.slot && (
                  <button
                    onClick={() => equipItem(item.id)}
                    className="bg-gold text-wood text-xs font-medium px-3 py-1 rounded hover:bg-yellow-500 cursor-pointer"
                  >
                    Equipar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
