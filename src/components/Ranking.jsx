import { useEffect, useState } from 'react';
import { loadAllCharacters } from '../services/firebase';
import CharacterPopup from './CharacterPopup';

export default function Ranking() {
  const [characters, setCharacters] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadAllCharacters()
      .then((list) => {
        if (cancelled) return;
        setCharacters(list.filter((c) => c.name).sort((a, b) => (b.level ?? 0) - (a.level ?? 0)));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Falha ao carregar ranking:', err);
        setError(err?.code || err?.message || 'Erro desconhecido.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ RANKING</h3>
        <p className="text-[11px] text-neutral-500">
          Todas as contas cadastradas, do nível mais alto pro mais baixo. Clique num nome
          pra ver a ficha completa (atributos, equipamento, talentos).
        </p>
      </div>

      {error && (
        <p className="text-sm text-blood bg-wood-light border border-wood-lighter rounded-lg p-3">
          Não deu pra carregar o ranking: {error}
        </p>
      )}

      {!error && !characters && <p className="text-sm text-neutral-400">Carregando...</p>}

      {characters && characters.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhuma conta encontrada.</p>
      )}

      {characters && characters.length > 0 && (
        <div className="bg-wood-light border border-wood-lighter rounded-lg overflow-hidden">
          {characters.map((char, i) => (
            <button
              key={char.uid}
              onClick={() => setSelected(char)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-wood-lighter
                         last:border-b-0 hover:bg-wood-lighter cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-neutral-500 w-6 shrink-0 text-right">{i + 1}º</span>
                <span className="text-sm text-neutral-100 truncate">{char.name}</span>
                <span className="text-[11px] text-neutral-500 shrink-0">{char.class}</span>
              </span>
              <span className="text-sm text-gold font-semibold shrink-0">Nv. {char.level ?? 1}</span>
            </button>
          ))}
        </div>
      )}

      {selected && <CharacterPopup character={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
