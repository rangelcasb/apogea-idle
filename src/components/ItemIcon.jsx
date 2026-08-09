import { useState } from 'react';
import { getItemImageUrl, getItemSpriteStyle } from '../data/itemImages';

// Ícones reais do apogea-tools.lubien.dev (mesma fonte dos stats/preços dos itens).
// Nem todo item tem ícone lá — pra esses, tenta o sprite sheet real do próprio
// cliente do jogo (ver getItemSpriteStyle); só cai pra um emoji genérico se nenhuma
// das duas fontes tiver o item (ou a imagem falhar ao carregar).
export default function ItemIcon({ name, className = 'w-8 h-8' }) {
  const url = getItemImageUrl(name);
  const [failed, setFailed] = useState(false);
  const spriteStyle = getItemSpriteStyle(name);

  if ((!url || failed) && spriteStyle) {
    return <span className={`${className} shrink-0 inline-block`} style={spriteStyle} title={name} />;
  }
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
