import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  runTransaction,
} from 'firebase/firestore';

// Preencha com as credenciais do seu projeto Firebase (Console > Configurações do projeto).
// Nunca comite chaves reais em repositórios públicos: use variáveis de ambiente (.env).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Login com Google — a MESMA conta em qualquer dispositivo dá o mesmo UID, então
// o personagem sincroniza sozinho sem precisar de código nenhum (diferente do login
// anônimo, que gera um UID novo e desconectado em cada navegador/dispositivo).
// Popup (não redirect): o redirect depende de um "cofre" de dados guardado no domínio
// do Firebase (apogeaidle.firebaseapp.com) que o navegador trata como terceiro em
// relação ao site — em vários navegadores isso se perde durante a ida-e-volta e o
// login falha silenciosamente. Popup conversa com a janela do site em tempo real, sem
// depender desse armazenamento; o vercel.json ajusta o cabeçalho COOP que antes fazia
// o popup fechar sozinho.
export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function saveGameState(userId, state) {
  // O Firestore recusa salvar qualquer campo com valor "undefined" (lança erro em vez
  // de simplesmente ignorar o campo). O round-trip por JSON remove esses campos antes
  // de mandar, do mesmo jeito que localStorage.setItem(JSON.stringify(...)) já fazia.
  const clean = JSON.parse(JSON.stringify(state));
  await setDoc(doc(db, 'characters', userId), clean, { merge: true });
}

export async function loadGameState(userId) {
  const snap = await getDoc(doc(db, 'characters', userId));
  return snap.exists() ? snap.data() : null;
}

// Ranking: lista o personagem de TODA conta cadastrada. Exige que a regra do Firestore
// libere leitura da coleção inteira pra qualquer usuário logado (por padrão só permite
// cada conta ler o próprio documento) — ver Console > Firestore > Regras.
export async function loadAllCharacters() {
  const snap = await getDocs(collection(db, 'characters'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// Comércio entre jogadores: mercado de preço fixo, tipo NPC — compra instantânea, sem
// leilão/lance/espera. Reaproveita a coleção 'auctions' já liberada no Console (o nome
// ficou desatualizado, mas trocar exigiria você mexer nas Regras de novo à toa).
// Continua no modelo "confia no cliente" (mesmo nível de confiança que gold/itens/level
// já têm hoje): cada jogador só mexe no PRÓPRIO gold/banco localmente, o documento
// compartilhado é só o "balcão" com o item e o preço.
export async function createListing(listing) {
  const clean = JSON.parse(JSON.stringify(listing));
  const ref = await addDoc(collection(db, 'auctions'), clean);
  return ref.id;
}

export async function loadListings() {
  const snap = await getDocs(collection(db, 'auctions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Transação: só confirma a compra se o anúncio ainda estiver "active" no exato
// momento da escrita — evita dois jogadores comprando o mesmo item ao mesmo tempo (o
// segundo cai no catch e não perde gold nenhum). O vendedor recebe o gold sozinho
// depois (claimSellerPayout), nunca é essa função que mexe na conta dele.
export async function buyListing(listingId, { uid, name }) {
  const ref = doc(db, 'auctions', listingId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Esse anúncio não existe mais.');
    const data = snap.data();
    if (data.status !== 'active') throw new Error('Esse item já foi vendido.');
    if (data.sellerUid === uid) throw new Error('Você não pode comprar o próprio item.');
    tx.update(ref, { status: 'sold', buyerUid: uid, buyerName: name, soldAt: Date.now(), sellerPaid: false });
    return { item: data.item, price: data.price };
  });
}

// O vendedor recebe o gold sozinho, na próxima vez que abrir a aba (ninguém mais mexe
// no gold dele além dele mesmo).
export async function claimSellerPayout(listingId, sellerUid) {
  const ref = doc(db, 'auctions', listingId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const data = snap.data();
    if (data.status !== 'sold' || data.sellerUid !== sellerUid || data.sellerPaid) return 0;
    tx.update(ref, { sellerPaid: true });
    return data.price;
  });
}

// Cancelar um anúncio que ainda não vendeu — só o próprio vendedor, devolve o item
// pro banco dele mesmo.
export async function cancelListing(listingId, sellerUid) {
  const ref = doc(db, 'auctions', listingId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.status !== 'active' || data.sellerUid !== sellerUid) return null;
    tx.update(ref, { status: 'cancelled' });
    return data.item;
  });
}
