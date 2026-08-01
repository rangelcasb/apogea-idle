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
