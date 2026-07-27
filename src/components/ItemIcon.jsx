import { useState } from 'react';
import { getItemImageUrl } from '../data/itemImages';

// Ícones reais do apogea-tools.lubien.dev (mesma fonte dos stats/preços dos itens).
// Nem todo item tem ícone lá — quando não tem (ou a imagem falha ao carregar), cai
// pra um emoji genérico em vez de deixar um espaço quebrado.
export default function ItemIcon({ name, className = 'w-8 h-8' }) {
  const url = getItemImageUrl(name);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <span className={`${className} flex items-center justify-center text-neutral-600 shrink-0`}>📦</span>;
  }

  return (
    <img
      src={url}
      alt={name}
      className={`${className} shrink-0 object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
