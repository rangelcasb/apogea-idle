import { useState } from 'react';
import { ALL_ITEM_NAMES, RARITY_LABELS } from '../data/gameData';
import ItemIcon from './ItemIcon';

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export default function Blacklist({ character, addToBlacklist, removeFromBlacklist }) {
  const [input, setInput] = useState('');
  const [minRarity, setMinRarity] = useState('');
  const blacklist = character.itemBlacklist ?? [];

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    addToBlacklist(name, minRarity || null);
    setInput('');
    setMinRarity('');
  };

  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ BLACKLIST DE ITENS</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Itens nessa lista não são pegos ao derrotar monstros — como se o drop nem tivesse
          acontecido. Escolha uma raridade mínima pra só bloquear as versões mais fracas (ex:
          Torch com "a partir de Épico" deixa passar Torch épica/lendária, mas ignora
          comum/incomum/rara). Deixe em "qualquer raridade" pra bloquear sempre. Você também
          pode adicionar um item direto pela Mochila.
        </p>
        <div className="flex flex-wrap gap-2 max-w-2xl">
          <input
            type="text"
            list="blacklist-item-names"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nome exato do item..."
            className="flex-1 min-w-[180px] bg-wood border border-wood-lighter rounded px-3 py-1.5 text-sm
                       text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-gold"
          />
          <datalist id="blacklist-item-names">
            {ALL_ITEM_NAMES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <select
            value={minRarity}
            onChange={(e) => setMinRarity(e.target.value)}
            className="bg-wood border border-wood-lighter rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-gold"
          >
            <option value="">Bloquear qualquer raridade</option>
            {RARITY_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Pegar a partir de {RARITY_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="text-sm font-medium bg-gold text-wood px-4 py-1.5 rounded
                       disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
          >
            ADICIONAR
          </button>
        </div>
      </div>

      {blacklist.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum item na blacklist.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {blacklist.map((entry) => (
            <div
              key={entry.name}
              className="bg-wood-light border border-wood-lighter rounded-lg p-3 flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ItemIcon name={entry.name} />
                <span className="min-w-0">
                  <p className="text-sm text-neutral-100 truncate">{entry.name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {entry.minRarity ? `pega a partir de ${RARITY_LABELS[entry.minRarity]}` : 'bloqueado sempre'}
                  </p>
                </span>
              </span>
              <button
                onClick={() => removeFromBlacklist(entry.name)}
                className="text-[11px] font-medium bg-wood-lighter px-2.5 py-1 rounded shrink-0 cursor-pointer hover:text-blood"
              >
                REMOVER
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
