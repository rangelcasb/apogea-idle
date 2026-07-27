import { useState } from 'react';
import { ALL_ITEM_NAMES } from '../data/gameData';
import ItemIcon from './ItemIcon';

export default function Blacklist({ character, addToBlacklist, removeFromBlacklist }) {
  const [input, setInput] = useState('');
  const blacklist = character.itemBlacklist ?? [];

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    addToBlacklist(name);
    setInput('');
  };

  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ BLACKLIST DE ITENS</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Itens nessa lista nunca são pegos ao derrotar monstros — como se o drop nem tivesse
          acontecido. Você também pode adicionar um item direto pela Mochila.
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            list="blacklist-item-names"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nome exato do item..."
            className="flex-1 bg-wood border border-wood-lighter rounded px-3 py-1.5 text-sm
                       text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-gold"
          />
          <datalist id="blacklist-item-names">
            {ALL_ITEM_NAMES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
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
          {blacklist.map((name) => (
            <div
              key={name}
              className="bg-wood-light border border-wood-lighter rounded-lg p-3 flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ItemIcon name={name} />
                <p className="text-sm text-neutral-100 truncate">{name}</p>
              </span>
              <button
                onClick={() => removeFromBlacklist(name)}
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
