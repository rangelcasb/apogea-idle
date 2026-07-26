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
  await setDoc(doc(db, 'characters', userId), state, { merge: true });
}

export async function loadGameState(userId) {
  const snap = await getDoc(doc(db, 'characters', userId));
  return snap.exists() ? snap.data() : null;
}
