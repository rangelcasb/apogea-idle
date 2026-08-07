// Ícones SVG simples (não são arte oficial do jogo — nenhuma das duas fontes de
// imagem que usamos (apogea-tools.lubien.dev e monster_images.json do apogeawiki.info)
// tem arte pros 24 monstros adicionados depois do lote original de 75). São só formas
// geométricas temáticas, num círculo com a paleta de cores do jogo (dourado/vermelho-
// sangue/madeira), pra cada monstro ter um ícone PRÓPRIO em vez de todos caírem no
// mesmo emoji genérico de fallback.
const GOLD = '#f0b932';
const BLOOD = '#b73b2c';
const BONE = '#d8cdb8';
const SHADOW = '#6b5a44';

function Badge({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#2e1e12" stroke="#3d2a19" strokeWidth="1" />
      {children}
    </svg>
  );
}

export const CUSTOM_MONSTER_SVG = {
  'Bridge Troll': () => (
    <Badge>
      <circle cx="12" cy="10" r="4" fill={SHADOW} />
      <path d="M6 19c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke={SHADOW} strokeWidth="2" strokeLinecap="round" />
      <rect x="10.5" y="14" width="3" height="7" rx="1" fill={BONE} transform="rotate(20 12 17)" />
    </Badge>
  ),
  'Brother Rossi': () => (
    <Badge>
      <path d="M12 4l6 15H6z" fill={BONE} />
      <circle cx="12" cy="9" r="2" fill="#2e1e12" />
      <path d="M12 11v6M9.5 14h5" stroke={BLOOD} strokeWidth="1.4" strokeLinecap="round" />
    </Badge>
  ),
  'Cold Baron': () => (
    <Badge>
      <path d="M6 12l2-6 4 3 4-3 2 6z" fill="#8fd0e6" />
      <circle cx="7" cy="10" r="1" fill={GOLD} />
      <circle cx="17" cy="10" r="1" fill={GOLD} />
      <circle cx="12" cy="8" r="1" fill={GOLD} />
      <path d="M12 14v6M9 17l3 3 3-3" stroke="#8fd0e6" strokeWidth="1.2" strokeLinecap="round" />
    </Badge>
  ),
  'Conquest Champion': () => (
    <Badge>
      <path d="M12 4l6 2v5c0 5-3 7.5-6 9-3-1.5-6-4-6-9V6z" fill={SHADOW} />
      <path d="M12 8l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill={GOLD} />
    </Badge>
  ),
  'Fallen Wings': () => (
    <Badge>
      <path d="M4 15c3-1 5-4 6-9 1 5-1 9-4 11z" fill={BONE} />
      <path d="M20 15c-3-1-5-4-6-9-1 5 1 9 4 11z" fill={BONE} />
      <path d="M11 19l1-3 1 3z" fill={BLOOD} />
    </Badge>
  ),
  Faun: () => (
    <Badge>
      <path d="M8 8c-2-2-2-4-1-5 1 1.5 2 2.5 3.2 3M16 8c2-2 2-4 1-5-1 1.5-2 2.5-3.2 3" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="13" r="5" fill={SHADOW} />
      <circle cx="10" cy="12" r="0.8" fill="#2e1e12" />
      <circle cx="14" cy="12" r="0.8" fill="#2e1e12" />
    </Badge>
  ),
  Ghost: () => (
    <Badge>
      <path d="M7 19V11a5 5 0 0110 0v8l-2-1.5L13 19l-1-1.5L10 19l-1.5-1.5z" fill="#e8e8ea" />
      <circle cx="10" cy="11" r="0.9" fill="#2e1e12" />
      <circle cx="14" cy="11" r="0.9" fill="#2e1e12" />
    </Badge>
  ),
  Ghoul: () => (
    <Badge>
      <circle cx="12" cy="12" r="6" fill="#5c6e4f" />
      <circle cx="9.5" cy="11" r="1" fill={BLOOD} />
      <circle cx="14.5" cy="11" r="1" fill={BLOOD} />
      <path d="M9 15c1 1 4 1 6 0" stroke="#2e1e12" strokeWidth="1.2" strokeLinecap="round" />
    </Badge>
  ),
  'Great Lintwurm (Static)': () => (
    <Badge>
      <path d="M5 17c2-3 3-8 7-8s3 6 7 3" stroke="#6fb3c9" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="17" cy="9" r="1.4" fill={GOLD} />
      <circle cx="9" cy="10" r="1" fill={GOLD} />
      <circle cx="13" cy="8.5" r="1" fill={GOLD} />
    </Badge>
  ),
  Huntsman: () => (
    <Badge>
      <path d="M7 5a10 10 0 000 14" stroke={BONE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M7 5l12 7-12 7" stroke={SHADOW} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d="M6 12h13M16 9l3 3-3 3" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Badge>
  ),
  'Lava Snoop': () => (
    <Badge>
      <path d="M12 4c3 4 5 6 5 9.5a5 5 0 01-10 0C7 10 9 8 12 4z" fill={BLOOD} />
      <path d="M12 10c1.3 1.8 2 3 2 4.2a2 2 0 01-4 0c0-1.2.7-2.4 2-4.2z" fill={GOLD} />
    </Badge>
  ),
  Minerva: () => (
    <Badge>
      <path d="M7 15a5 5 0 0110 0c0 2-1 3-1.5 4h-7C8 18 7 17 7 15z" fill={BONE} />
      <path d="M9 13l-2-2 1.5-.5L9 9l1.5 1.5L12 9l1.5 1.5L15 9l-.5 1.5L16 13l-2-1-2 1.5-2-1.5z" fill={SHADOW} />
      <circle cx="10" cy="15" r="0.9" fill="#2e1e12" />
      <circle cx="14" cy="15" r="0.9" fill="#2e1e12" />
    </Badge>
  ),
  Omen: () => (
    <Badge>
      <path d="M4 12c2.5-3.5 5.5-5 8-5s5.5 1.5 8 5c-2.5 3.5-5.5 5-8 5s-5.5-1.5-8-5z" fill={BONE} />
      <circle cx="12" cy="12" r="3" fill={BLOOD} />
      <circle cx="12" cy="12" r="1.2" fill="#2e1e12" />
    </Badge>
  ),
  'Queen Zoe': () => (
    <Badge>
      <path d="M6 16l1-6 3 3 2-4 2 4 3-3 1 6z" fill={GOLD} />
      <rect x="6" y="16" width="12" height="2" rx="0.5" fill={GOLD} />
      <circle cx="12" cy="8" r="1" fill={BLOOD} />
    </Badge>
  ),
  Rotwurm: () => (
    <Badge>
      <path d="M5 16c1-4 2-8 4-8s2 3 4 3 2-3 4-3 3 4 4 8" stroke="#7a6a3c" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="6.5" cy="15.5" r="1.1" fill={BLOOD} />
    </Badge>
  ),
  'Skal Brawler': () => (
    <Badge>
      <rect x="7" y="9" width="10" height="7" rx="2" fill={BONE} />
      <rect x="7.5" y="7" width="2" height="3" rx="0.8" fill={BONE} />
      <rect x="10.5" y="7" width="2" height="3" rx="0.8" fill={BONE} />
      <rect x="13.5" y="7" width="2" height="3" rx="0.8" fill={BONE} />
    </Badge>
  ),
  'Skal Traitor': () => (
    <Badge>
      <path d="M8 6l9 9-2 2-9-9z" fill="#c9c9cf" />
      <path d="M8 6L6 8l2 2 2-2z" fill={SHADOW} />
      <path d="M15 15l2 4-4-2z" fill={BLOOD} />
    </Badge>
  ),
  'Smelt Ooze': () => (
    <Badge>
      <path d="M12 6c3 3 5 6.5 5 9a5 5 0 01-10 0c0-2.5 2-6 5-9z" fill="#8a6f3a" opacity="0.9" />
      <circle cx="10.5" cy="16" r="1" fill={GOLD} opacity="0.8" />
      <circle cx="13.5" cy="14.5" r="0.8" fill={GOLD} opacity="0.8" />
    </Badge>
  ),
  'Swamp Tentacle': () => (
    <Badge>
      <path d="M12 19c0-4-3-4-3-8s3-5 3-8" stroke="#4f6e4a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M12 19c0-4 3-4 3-8" stroke="#4f6e4a" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
    </Badge>
  ),
  'The Black Knight': () => (
    <Badge>
      <path d="M7 10c0-3 2-5 5-5s5 2 5 5v3c0 3-2 5-5 6-3-1-5-3-5-6z" fill="#2a2a2f" stroke={GOLD} strokeWidth="0.6" />
      <rect x="7" y="11" width="10" height="1.6" fill={BLOOD} />
    </Badge>
  ),
  Thug: () => (
    <Badge>
      <circle cx="12" cy="11" r="4.5" fill={BONE} />
      <path d="M9 9l1.2-2M15 9l-1.2-2" stroke="#2e1e12" strokeWidth="1" strokeLinecap="round" />
      <rect x="10.5" y="15" width="3" height="5" rx="1" fill={SHADOW} />
    </Badge>
  ),
  Titan: () => (
    <Badge>
      <path d="M12 5l6 3v4c0 5-3 8-6 9-3-1-6-4-6-9V8z" fill={SHADOW} />
      <path d="M9 11h6M8 14h8" stroke={GOLD} strokeWidth="1.2" strokeLinecap="round" />
    </Badge>
  ),
  'Unstable Quartz': () => (
    <Badge>
      <path d="M12 4l4 5-4 11-4-11z" fill="#9b6fd6" />
      <path d="M8 9h8" stroke="#c9a8ef" strokeWidth="1" />
    </Badge>
  ),
  Wisp: () => (
    <Badge>
      <circle cx="12" cy="12" r="3.2" fill="#8fe0d8" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" stroke="#8fe0d8" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </Badge>
  ),
};
