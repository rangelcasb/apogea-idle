import { useEffect, useState, useCallback } from 'react';
import { RARITY_COLORS, RARITY_LABELS, formatItemStats } from '../data/gameData';
import ItemIcon from './ItemIcon';

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function timeLeftLabel(expiresAt, now) {
  const ms = expiresAt - now;
  if (ms <= 0) return 'expirado';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${m}min` : `${m}min`;
}

function AuctionCard({ auction, now, isMine, user, onBid }) {
  const [bidInput, setBidInput] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const floor = auction.currentBid ?? auction.startPrice;
  const expired = now >= auction.expiresAt;
  const isHighBidder = auction.currentBidderUid === user?.uid;
  const item = auction.item;

  const handleBid = async () => {
    const amount = Number(bidInput);
    if (!amount || amount <= floor) {
      setError(`O lance precisa ser maior que ${floor}g.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onBid(auction.id, amount);
      setBidInput('');
    } catch (err) {
      setError(err?.message ?? 'Não deu pra dar o lance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`bg-wood border rounded-lg p-3 flex flex-col gap-2 ${RARITY_COLORS[item.rarity] ? 'border-wood-lighter' : 'border-wood-lighter'}`}>
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
            vendedor: {auction.sellerName}
            {isMine && <span className="text-gold"> (você)</span>}
          </p>
        </div>
      </div>
      {item.stats && <p className="text-[10px] text-gold">{formatItemStats(item.stats)}</p>}
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-300">
          {auction.currentBid ? (
            <>Lance atual: <span className="text-gold font-semibold">{auction.currentBid}g</span></>
          ) : (
            <>Preço inicial: <span className="text-gold font-semibold">{auction.startPrice}g</span></>
          )}
        </span>
        <span className={expired ? 'text-blood' : 'text-neutral-400'}>{timeLeftLabel(auction.expiresAt, now)}</span>
      </div>
      {isHighBidder && <p className="text-[10px] text-green-400">Você é o maior lance no momento.</p>}

      {!isMine && !expired && (
        <div className="flex gap-1.5">
          <input
            type="number"
            min={floor + 1}
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value)}
            placeholder={`> ${floor}g`}
            className="flex-1 min-w-0 bg-wood-light border border-wood-lighter rounded px-2 py-1 text-xs text-neutral-100
                       placeholder:text-neutral-500 focus:outline-none focus:border-gold"
          />
          <button
            onClick={handleBid}
            disabled={submitting || isHighBidder}
            className="text-[11px] font-medium bg-gold text-wood px-2.5 py-1 rounded cursor-pointer hover:bg-yellow-500
                       disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            DAR LANCE
          </button>
        </div>
      )}
      {error && <p className="text-[10px] text-blood">{error}</p>}
    </div>
  );
}

export default function Leilao({ character, user, fetchAuctions, listItemForAuction, placeBidOnAuction, reconcileAuctions }) {
  const now = useNow(30000);
  const [auctions, setAuctions] = useState(null);
  const [error, setError] = useState(null);
  const [selectedBankItemId, setSelectedBankItemId] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [listing, setListing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const fetched = await fetchAuctions();
      await reconcileAuctions(fetched);
      // Busca de novo depois de reconciliar — o estado dos leilões pode ter mudado
      // (leilão que eu fechei, item que eu resgatei, etc.).
      const fresh = await fetchAuctions();
      setAuctions(fresh);
    } catch (err) {
      setError(err?.code || err?.message || 'Erro desconhecido.');
    }
  }, [fetchAuctions, reconcileAuctions]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBid = async (auctionId, amount) => {
    await placeBidOnAuction(auctionId, amount);
    refresh();
  };

  const handleList = async () => {
    const price = Number(startPrice);
    if (!selectedBankItemId || !price || price <= 0) return;
    setListing(true);
    try {
      await listItemForAuction(selectedBankItemId, price);
      setSelectedBankItemId('');
      setStartPrice('');
      refresh();
    } catch (err) {
      setError(err?.message ?? 'Não deu pra colocar o item no leilão.');
    } finally {
      setListing(false);
    }
  };

  const activeAuctions = (auctions ?? []).filter((a) => a.status === 'active');
  const mine = activeAuctions.filter((a) => a.sellerUid === user?.uid);
  const others = activeAuctions.filter((a) => a.sellerUid !== user?.uid);
  const bankItems = character.bank ?? [];

  return (
    <div className="flex-1 space-y-4">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ LEILÃO</h3>
        <p className="text-[11px] text-neutral-500">
          Coloque um item do seu Banco à venda — fica exposto por 2h recebendo lances de
          outros jogadores. Se ninguém der lance, o item volta pro seu banco quando você
          reabrir essa aba depois do prazo; se vender, o gold cai pra você e o item vai
          pro vencedor — cada um resgata a própria parte sozinho, por isso é importante
          reabrir essa aba de vez em quando.
        </p>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h4 className="text-gold text-sm font-semibold mb-2">◆ COLOCAR ITEM À VENDA</h4>
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
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              placeholder="Preço inicial (gold)"
              className="w-40 bg-wood border border-wood-lighter rounded px-2 py-1.5 text-sm text-neutral-100
                         placeholder:text-neutral-500 focus:outline-none focus:border-gold"
            />
            <button
              onClick={handleList}
              disabled={!selectedBankItemId || !startPrice || listing}
              className="text-sm font-medium bg-gold text-wood px-4 py-1.5 rounded cursor-pointer hover:bg-yellow-500
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              LEILOAR
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-blood bg-wood-light border border-wood-lighter rounded-lg p-3">
          Erro no leilão: {error}
        </p>
      )}

      {!auctions && !error && <p className="text-sm text-neutral-400">Carregando leilões...</p>}

      {mine.length > 0 && (
        <div>
          <h4 className="text-gold text-sm font-semibold mb-2">◆ SEUS LEILÕES ATIVOS</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {mine.map((a) => (
              <AuctionCard key={a.id} auction={a} now={now} isMine user={user} onBid={handleBid} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-gold text-sm font-semibold mb-2">◆ LEILÕES DE OUTROS JOGADORES</h4>
        {others.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum leilão ativo no momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {others.map((a) => (
              <AuctionCard key={a.id} auction={a} now={now} isMine={false} user={user} onBid={handleBid} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
