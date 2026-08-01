import { useEffect, useState, useCallback } from 'react';
import { RARITY_COLORS, RARITY_LABELS, formatItemStats } from '../data/gameData';
import ItemIcon from './ItemIcon';

function ListingCard({ listing, isMine, canAfford, onBuy, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const item = listing.item;

  const handleBuy = async () => {
    setBusy(true);
    setError(null);
    try {
      await onBuy(listing.id);
    } catch (err) {
      setError(err?.message ?? 'Não deu pra comprar.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await onCancel(listing.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-wood border border-wood-lighter rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <ItemIcon name={item.name} className="w-8 h-8 shrink-0" />
        <div className="min-w-0">
          <p className={`text-sm truncate ${RARITY_COLORS[item.rarity] ?? 'text-neutral-100'}`}>
            {item.name}
            {item.rarity && item.rarity !== 'common' && (
              <span className="text-[10px] ml-1">({RARITY_LABELS[item.rarity]})</span>
            )}
          </p>
          <p className="text-[10px] text-neutral-500">
            vendedor: {listing.sellerName}
            {isMine && <span className="text-gold"> (você)</span>}
          </p>
        </div>
      </div>
      {item.stats && <p className="text-[10px] text-gold">{formatItemStats(item.stats)}</p>}
      <p className="text-sm text-gold font-semibold">{listing.price}g</p>

      {isMine ? (
        <button
          onClick={handleCancel}
          disabled={busy}
          className="text-[11px] font-medium bg-wood-light border border-wood-lighter px-2.5 py-1 rounded cursor-pointer
                     hover:border-blood hover:text-blood disabled:opacity-30 disabled:cursor-not-allowed"
        >
          CANCELAR ANÚNCIO
        </button>
      ) : (
        <button
          onClick={handleBuy}
          disabled={busy || !canAfford}
          title={!canAfford ? 'Gold insuficiente' : undefined}
          className="text-[11px] font-medium bg-gold text-wood px-2.5 py-1 rounded cursor-pointer hover:bg-yellow-500
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          COMPRAR
        </button>
      )}
      {error && <p className="text-[10px] text-blood">{error}</p>}
    </div>
  );
}

export default function ComercioJogadores({
  character,
  user,
  fetchListings,
  listItemOnMarket,
  buyMarketListing,
  cancelMarketListing,
  reconcileMarketPayouts,
}) {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);
  const [selectedBankItemId, setSelectedBankItemId] = useState('');
  const [price, setPrice] = useState('');
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const fetched = await fetchListings();
      await reconcileMarketPayouts(fetched);
      // Busca de novo depois de reconciliar — o próprio anúncio pode ter mudado
      // (marcado como pago, por exemplo).
      const fresh = await fetchListings();
      setListings(fresh);
    } catch (err) {
      setError(err?.code || err?.message || 'Erro desconhecido.');
    }
  }, [fetchListings, reconcileMarketPayouts]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = async (listingId) => {
    await buyMarketListing(listingId);
    refresh();
  };

  const handleCancel = async (listingId) => {
    await cancelMarketListing(listingId);
    refresh();
  };

  const handleList = async () => {
    const p = Number(price);
    if (!selectedBankItemId || !p || p <= 0) return;
    setPosting(true);
    setError(null);
    try {
      await listItemOnMarket(selectedBankItemId, p);
      setSelectedBankItemId('');
      setPrice('');
      refresh();
    } catch (err) {
      setError(err?.message ?? 'Não deu pra anunciar o item.');
    } finally {
      setPosting(false);
    }
  };

  const activeListings = (listings ?? []).filter((l) => l.status === 'active');
  const mine = activeListings.filter((l) => l.sellerUid === user?.uid);
  const others = activeListings.filter((l) => l.sellerUid !== user?.uid);
  const bankItems = character.bank ?? [];

  return (
    <div className="flex-1 space-y-4">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ COMÉRCIO ENTRE JOGADORES</h3>
        <p className="text-[11px] text-neutral-500">
          Anuncie um item do seu Banco por um preço fixo — qualquer outro jogador pode
          comprar na hora, igual um mercador NPC. O item vai pro comprador na mesma hora;
          o gold só cai pra você quando você reabrir essa aba de novo (cada um resgata o
          próprio dinheiro sozinho, sem precisar de servidor rodando o tempo todo).
        </p>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h4 className="text-gold text-sm font-semibold mb-2">◆ ANUNCIAR ITEM</h4>
        {bankItems.length === 0 ? (
          <p className="text-xs text-neutral-500">Nenhum item no banco. Deposite algo na aba Banco primeiro.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedBankItemId}
              onChange={(e) => setSelectedBankItemId(e.target.value)}
              className="bg-wood border border-wood-lighter rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-gold"
            >
              <option value="">Escolha um item do banco...</option>
              {bankItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ×{i.quantity}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Preço (gold)"
              className="w-40 bg-wood border border-wood-lighter rounded px-2 py-1.5 text-sm text-neutral-100
                         placeholder:text-neutral-500 focus:outline-none focus:border-gold"
            />
            <button
              onClick={handleList}
              disabled={!selectedBankItemId || !price || posting}
              className="text-sm font-medium bg-gold text-wood px-4 py-1.5 rounded cursor-pointer hover:bg-yellow-500
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ANUNCIAR
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-blood bg-wood-light border border-wood-lighter rounded-lg p-3">
          Erro no comércio: {error}
        </p>
      )}

      {!listings && !error && <p className="text-sm text-neutral-400">Carregando anúncios...</p>}

      {mine.length > 0 && (
        <div>
          <h4 className="text-gold text-sm font-semibold mb-2">◆ SEUS ANÚNCIOS</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {mine.map((l) => (
              <ListingCard key={l.id} listing={l} isMine onCancel={handleCancel} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-gold text-sm font-semibold mb-2">◆ À VENDA POR OUTROS JOGADORES</h4>
        {others.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum item à venda no momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {others.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                isMine={false}
                canAfford={character.gold >= l.price}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
