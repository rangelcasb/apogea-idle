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

// Leilão: coleção compartilhada 'auctions' — qualquer conta autenticada pode ler e
// escrever (modelo "confia no cliente", igual o resto do jogo: não tem servidor
// validando cada lance, então em teoria dá pra trapacear mexendo direto no Firestore,
// mas é o MESMO nível de confiança que gold/itens/level já têm hoje). Cada jogador só
// mexe no PRÓPRIO gold/banco localmente — o documento do leilão em si é só o "quadro
// de avisos" compartilhado (item, lance atual, quem tá devendo reembolso pra quem).
// Exige liberar leitura/escrita da coleção 'auctions' pra qualquer usuário logado no
// Console > Firestore > Regras (é uma coleção separada de 'characters').
export async function createAuction(auction) {
  const clean = JSON.parse(JSON.stringify(auction));
  const ref = await addDoc(collection(db, 'auctions'), clean);
  return ref.id;
}

export async function loadAuctions() {
  const snap = await getDocs(collection(db, 'auctions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Transação: só aceita o lance se, no exato momento da escrita, ele ainda for maior
// que o lance atual — evita a corrida de dois jogadores dando lance ao mesmo tempo.
// Quem tinha o lance anterior entra em "pendingRefunds" pra reaver o próprio gold
// sozinho, na próxima vez que abrir a aba Leilão.
export async function placeBid(auctionId, { uid, name, amount }) {
  const ref = doc(db, 'auctions', auctionId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Leilão não existe mais.');
    const data = snap.data();
    if (data.status !== 'active') throw new Error('Esse leilão já foi encerrado.');
    if (Date.now() >= data.expiresAt) throw new Error('Esse leilão já expirou.');
    if (data.sellerUid === uid) throw new Error('Você não pode dar lance no seu próprio item.');
    if (data.currentBidderUid === uid) throw new Error('Você já é o maior lance.');
    const floor = data.currentBid ?? data.startPrice;
    if (amount <= floor) throw new Error(`O lance precisa ser maior que ${floor}g.`);

    const pendingRefunds = [...(data.pendingRefunds ?? [])];
    if (data.currentBidderUid) {
      pendingRefunds.push({ uid: data.currentBidderUid, name: data.currentBidderName, amount: data.currentBid });
    }

    tx.update(ref, {
      currentBid: amount,
      currentBidderUid: uid,
      currentBidderName: name,
      pendingRefunds,
    });
  });
}

// Cada jogador resgata só os PRÓPRIOS reembolsos pendentes — nunca mexe no gold de
// ninguém além do seu. Chamado automaticamente ao abrir a aba Leilão.
export async function claimAuctionRefunds(auctionId, uid) {
  const ref = doc(db, 'auctions', auctionId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const data = snap.data();
    const mine = (data.pendingRefunds ?? []).filter((r) => r.uid === uid);
    if (mine.length === 0) return 0;
    const total = mine.reduce((sum, r) => sum + r.amount, 0);
    const rest = (data.pendingRefunds ?? []).filter((r) => r.uid !== uid);
    tx.update(ref, { pendingRefunds: rest });
    return total;
  });
}

// Só o próprio vendedor fecha o leilão vencido, ao abrir a aba de novo — decide se
// teve vencedor (recebe o gold) ou devolve o item pra si mesmo (sem lances).
export async function settleAuction(auctionId, sellerUid) {
  const ref = doc(db, 'auctions', auctionId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.status !== 'active' || data.sellerUid !== sellerUid || Date.now() < data.expiresAt) return null;

    if (data.currentBidderUid) {
      tx.update(ref, {
        status: 'settled',
        winnerUid: data.currentBidderUid,
        winnerName: data.currentBidderName,
        winningBid: data.currentBid,
        claimedByWinner: false,
      });
      return { sold: true, amount: data.currentBid };
    }
    tx.update(ref, { status: 'returned' });
    return { sold: false };
  });
}

// O vencedor busca o item pro próprio banco sozinho, na próxima vez que abrir a aba.
export async function claimWonItem(auctionId, winnerUid) {
  const ref = doc(db, 'auctions', auctionId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.status !== 'settled' || data.winnerUid !== winnerUid || data.claimedByWinner) return null;
    tx.update(ref, { claimedByWinner: true });
    return data.item;
  });
}
