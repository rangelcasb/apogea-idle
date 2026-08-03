import { useState, useMemo } from 'react';
import { MERCHANTS, getShopItemDefinition, formatItemStats } from '../data/gameData';
import ItemIcon from './ItemIcon';

// Busca por nome de item em TODOS os mercadores de uma vez — sem isso, achar quem
// vende/compra um item específico exigia clicar um por um nos 53 NPCs.
function searchItemAcrossMerchants(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const results = [];
  for (const merchant of MERCHANTS) {
    for (const offer of merchant.sells) {
      if (offer.name.toLowerCase().includes(q)) {
        results.push({ merchant, offer, kind: 'sell' });
      }
    }
    for (const offer of merchant.buys) {
      if (offer.name.toLowerCase().includes(q)) {
        results.push({ merchant, offer, kind: 'buy' });
      }
    }
  }
  return results;
}

function clampQty(value) {
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(999, n));
}

// Popup de quantidade: abre ao clicar em COMPRAR, some ao confirmar/cancelar/clicar
// fora. Se a quantidade pedida passar do que o gold ou a mochila permitem, o reducer
// (BUY_ITEM) não recusa a compra inteira — compra o máximo possível e avisa no log.
function BuyQuantityModal({ merchantName, itemName, price, weight, gold, freeCapacity, buyItem, onClose }) {
  const [qty, setQty] = useState(1);
  const maxByGold = Math.max(0, Math.floor(gold / price));
  const maxByCapacity = weight > 0 ? Math.max(0, Math.floor(freeCapacity / weight)) : 999;
  const maxAffordable = Math.min(999, maxByGold, maxByCapacity);

  function confirm() {
    buyItem(merchantName, itemName, qty);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-wood border border-gold rounded-lg max-w-xs w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <ItemIcon name={itemName} />
          <h3 className="text-gold font-semibold">{itemName}</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4">{price}g cada · você tem {gold}g</p>

        <label className="flex flex-col gap-1 mb-2">
          <span className="text-[11px] text-neutral-400">Quantidade</span>
          <input
            type="number"
            autoFocus
            min={1}
            max={999}
            value={qty}
            onChange={(e) => setQty(clampQty(e.target.value))}
            className="w-full bg-wood-light border border-wood-lighter rounded px-2.5 py-1.5 text-sm
                       text-neutral-100 focus:outline-none focus:border-gold"
          />
        </label>
        {maxAffordable > 0 && (
          <button
            onClick={() => setQty(maxAffordable)}
            className="text-[10px] text-gold hover:underline cursor-pointer mb-3"
          >
            máximo possível: {maxAffordable}x
          </button>
        )}

        <p className="text-sm text-neutral-200 mb-1">
          Total: <span className="text-gold font-medium">{price * qty}g</span>
        </p>
        {qty > maxAffordable && (
          <p className="text-[11px] text-blood mb-3">
            Você só consegue {maxAffordable}x agora ({maxByGold < maxByCapacity ? 'gold insuficiente' : 'mochila cheia'})
            — a compra vai trazer só o que der.
          </p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-medium bg-wood-lighter px-3 py-1.5 rounded cursor-pointer hover:border-blood hover:text-blood"
          >
            CANCELAR
          </button>
          <button
            onClick={confirm}
            disabled={maxAffordable <= 0}
            className="flex-1 text-xs font-medium bg-green-700 text-white px-3 py-1.5 rounded
                       disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-green-600"
          >
            COMPRAR
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Mercador({ character, buyItem, sellToMerchant, autoCombat }) {
  const [selectedName, setSelectedName] = useState(MERCHANTS[0].name);
  const [search, setSearch] = useState('');
  // Item selecionado pro popup de quantidade — null quando fechado.
  const [buyTarget, setBuyTarget] = useState(null);
  const merchant = MERCHANTS.find((m) => m.name === selectedName);

  // Pré-visualiza os atributos de cada item à venda/compra (raridade "common" — a
  // loja vende um item fixo, sem sortear raridade como um drop de monstro).
  const statsPreview = useMemo(() => {
    const names = new Set([...merchant.sells.map((o) => o.name), ...merchant.buys.map((o) => o.name)]);
    return Object.fromEntries([...names].map((name) => [name, getShopItemDefinition(name).stats ?? null]));
  }, [merchant]);

  const searchResults = useMemo(() => searchItemAcrossMerchants(search), [search]);

  const currentWeight = character.inventory.reduce((sum, i) => sum + (i.weight ?? 1) * i.quantity, 0);
  const freeCapacity = character.stats.capacity - currentWeight;
  // Peso do item que a compra vai adicionar — mesmo com gold sobrando, se não couber
  // na mochila (peso > capacidade livre) a compra é recusada.
  function itemWeight(name) {
    return getShopItemDefinition(name).weight ?? 1;
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4">
      {buyTarget && (
        <BuyQuantityModal
          merchantName={buyTarget.merchantName}
          itemName={buyTarget.itemName}
          price={buyTarget.price}
          weight={itemWeight(buyTarget.itemName)}
          gold={character.gold}
          freeCapacity={freeCapacity}
          buyItem={buyItem}
          onClose={() => setBuyTarget(null)}
        />
      )}

      <div className="w-full lg:w-56 shrink-0">
        <h3 className="text-gold font-semibold tracking-wide mb-3">◆ MERCADORES</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar item..."
          className="w-full bg-wood-light border border-wood-lighter rounded px-2.5 py-1.5 text-xs mb-2
                     text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-gold"
        />
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

      {searchResults ? (
        <div className="flex-1 bg-wood-light border border-wood-lighter rounded-lg p-4">
          <h3 className="text-gold font-semibold mb-1">Resultados para "{search}"</h3>
          <p className="text-xs text-neutral-500 mb-4">{searchResults.length} oferta(s) encontrada(s) entre os 53 mercadores.</p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum item encontrado.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {searchResults.map(({ merchant: m, offer, kind }) => {
                const owned = character.inventory.find((i) => i.name === offer.name);
                const stats = owned?.stats ?? statsPreview[offer.name] ?? getShopItemDefinition(offer.name).stats;
                return (
                  <div
                    key={`${m.name}-${kind}-${offer.name}`}
                    className="flex items-center justify-between bg-wood border border-wood-lighter rounded px-2.5 py-1.5 gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <ItemIcon name={offer.name} />
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-200">
                          {offer.name} <span className="text-neutral-500">({kind === 'sell' ? 'compra de' : 'venda para'} {m.name})</span>
                        </p>
                        {stats && <p className="text-[10px] text-gold truncate">{formatItemStats(stats)}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold">{offer.price}g</span>
                        {kind === 'sell' ? (
                          <button
                            onClick={() => setBuyTarget({ merchantName: m.name, itemName: offer.name, price: offer.price })}
                            disabled={autoCombat || character.gold < offer.price || itemWeight(offer.name) > freeCapacity}
                            className="text-[11px] font-medium bg-green-700 text-white px-2 py-0.5 rounded
                                       disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-green-600"
                          >
                            COMPRAR
                          </button>
                        ) : (
                          <button
                            onClick={() => sellToMerchant(m.name, owned.id)}
                            disabled={!owned || autoCombat}
                            className="text-[11px] font-medium bg-wood-lighter px-2 py-0.5 rounded
                                       disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-gold"
                          >
                            VENDER
                          </button>
                        )}
                      </div>
                      {kind === 'sell' && autoCombat && (
                        <span className="text-[10px] text-blood">em combate</span>
                      )}
                      {kind === 'sell' && !autoCombat && character.gold < offer.price && (
                        <span className="text-[10px] text-blood">faltam {offer.price - character.gold}g</span>
                      )}
                      {kind === 'sell' && !autoCombat && character.gold >= offer.price && itemWeight(offer.name) > freeCapacity && (
                        <span className="text-[10px] text-blood">
                          não cabe ({itemWeight(offer.name)}/{Math.max(0, Math.round(freeCapacity))} oz livres)
                        </span>
                      )}
                      {kind === 'buy' && !owned && (
                        <span className="text-[10px] text-neutral-600">você não tem</span>
                      )}
                      {kind === 'buy' && autoCombat && owned && (
                        <span className="text-[10px] text-blood">em combate</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
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
                    <div className="min-w-0 flex items-center gap-2">
                      <ItemIcon name={offer.name} />
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-200">{offer.name}</p>
                        {statsPreview[offer.name] && (
                          <p className="text-[10px] text-gold truncate">{formatItemStats(statsPreview[offer.name])}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold">{offer.price}g</span>
                        <button
                          onClick={() => setBuyTarget({ merchantName: merchant.name, itemName: offer.name, price: offer.price })}
                          disabled={autoCombat || character.gold < offer.price || itemWeight(offer.name) > freeCapacity}
                          className="text-[11px] font-medium bg-green-700 text-white px-2 py-0.5 rounded
                                     disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-green-600"
                        >
                          COMPRAR
                        </button>
                      </div>
                      {autoCombat && (
                        <span className="text-[10px] text-blood">em combate</span>
                      )}
                      {!autoCombat && character.gold < offer.price && (
                        <span className="text-[10px] text-blood">faltam {offer.price - character.gold}g</span>
                      )}
                      {!autoCombat && character.gold >= offer.price && itemWeight(offer.name) > freeCapacity && (
                        <span className="text-[10px] text-blood">
                          não cabe ({itemWeight(offer.name)}/{Math.max(0, Math.round(freeCapacity))} oz livres)
                        </span>
                      )}
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
                      <div className="min-w-0 flex items-center gap-2">
                        <ItemIcon name={offer.name} />
                        <div className="min-w-0">
                          <p className="text-xs text-neutral-200">
                            {offer.name} {owned && <span className="text-neutral-500">×{owned.quantity}</span>}
                          </p>
                          {stats && <p className="text-[10px] text-gold truncate">{formatItemStats(stats)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gold">{offer.price}g</span>
                        <button
                          onClick={() => sellToMerchant(merchant.name, owned.id)}
                          disabled={!owned || autoCombat}
                          title={autoCombat ? 'Pare a caçada pra vender' : undefined}
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
      )}
    </div>
  );
}
