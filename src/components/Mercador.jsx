import { useState, useMemo } from 'react';
import { MERCHANTS, getShopItemDefinition, formatItemStats } from '../data/gameData';

export default function Mercador({ character, buyItem, sellToMerchant }) {
  const [selectedName, setSelectedName] = useState(MERCHANTS[0].name);
  const merchant = MERCHANTS.find((m) => m.name === selectedName);

  // Pré-visualiza os atributos de cada item à venda/compra (raridade "common" — a
  // loja vende um item fixo, sem sortear raridade como um drop de monstro).
  const statsPreview = useMemo(() => {
    const names = new Set([...merchant.sells.map((o) => o.name), ...merchant.buys.map((o) => o.name)]);
    return Object.fromEntries([...names].map((name) => [name, getShopItemDefinition(name).stats ?? null]));
  }, [merchant]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-56 shrink-0">
        <h3 className="text-gold font-semibold tracking-wide mb-3">◆ MERCADORES</h3>
        <div className="flex flex-col gap-1 max-h-[70vh] overflow-y-auto pr-1">
          {MERCHANTS.map((m) => (
            <button
              key={m.name}
              onClick={() => setSelectedName(m.name)}
              className={`text-left text-xs px-2.5 py-1.5 rounded cursor-pointer
                ${selectedName === m.name ? 'bg-gold text-wood font-medium' : 'bg-wood-light text-neutral-300 hover:bg-wood-lighter'}`}
            >
              {m.name}
              <span className="block text-[10px] opacity-70">{m.location}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold mb-1">{merchant.name}</h3>
        <p className="text-xs text-neutral-500 mb-4">{merchant.location}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">Vende</h4>
            {merchant.sells.length === 0 ? (
              <p className="text-xs text-neutral-500">Nada à venda.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {merchant.sells.map((offer) => (
                  <div
                    key={offer.name}
                    className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-2.5 py-1.5 gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-200">{offer.name}</p>
                      {statsPreview[offer.name] && (
                        <p className="text-[10px] text-gold truncate">{formatItemStats(statsPreview[offer.name])}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gold">{offer.price}g</span>
                      <button
                        onClick={() => buyItem(merchant.name, offer.name)}
                        disabled={character.gold < offer.price}
                        className="text-[11px] font-medium bg-green-700 text-white px-2 py-0.5 rounded
                                   disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-green-600"
                      >
                        COMPRAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">Compra</h4>
            {merchant.buys.length === 0 ? (
              <p className="text-xs text-neutral-500">Não compra nada.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {merchant.buys.map((offer) => {
                  const owned = character.inventory.find((i) => i.name === offer.name);
                  const stats = owned?.stats ?? statsPreview[offer.name];
                  return (
                    <div
                      key={offer.name}
                      className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-2.5 py-1.5 gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-200">
                          {offer.name} {owned && <span className="text-neutral-500">×{owned.quantity}</span>}
                        </p>
                        {stats && <p className="text-[10px] text-gold truncate">{formatItemStats(stats)}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gold">{offer.price}g</span>
                        <button
                          onClick={() => sellToMerchant(merchant.name, owned.id)}
                          disabled={!owned}
                          className="text-[11px] font-medium bg-wood-lighter px-2 py-0.5 rounded
                                     disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-gold"
                        >
                          VENDER
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
