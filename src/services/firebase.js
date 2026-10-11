import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const auth = firebaseEnabled ? getAuth(initializeApp(config)) : null;

const DEMO_ACCOUNTS_KEY = 'vitra:demo-accounts';
const DEMO_SESSION_KEY = 'vitra:demo-session';
const DEMO_PASSWORD_ITERATIONS = 120000;

function readDemoAccounts() {
  try { return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}'); }
  catch { return {}; }
}

function encodeBytes(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function decodeBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: DEMO_PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return encodeBytes(bits);
}

function makeDemoUser(profile) {
  return { uid: `demo:${profile.email}`, email: profile.email, displayName: profile.name, role: profile.role, isDemo: true };
}

async function authenticateDemoAccount({ mode, email, password, role, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = readDemoAccounts();
  if (mode === 'signup') {
    if (accounts[normalizedEmail]) throw new Error('An account with this email already exists. Sign in instead.');
    if (!name?.trim()) throw new Error('Enter your name to create an account.');
    if (!globalThis.crypto?.subtle) throw new Error('Secure demo sign-in is unavailable in this browser. Use localhost or configure Firebase.');
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const profile = { email: normalizedEmail, name: name.trim(), role, salt: encodeBytes(salt), passwordHash: await derivePasswordHash(password, salt) };
    accounts[normalizedEmail] = profile;
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
    const user = makeDemoUser(profile);
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    return user;
  }

  const profile = accounts[normalizedEmail];
  if (!profile || !globalThis.crypto?.subtle) throw new Error('Email or password is incorrect.');
  const submittedHash = await derivePasswordHash(password, decodeBytes(profile.salt));
  if (submittedHash !== profile.passwordHash) throw new Error('Email or password is incorrect.');
  const user = makeDemoUser(profile);
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  return user;
}

export function watchAuthState(callback) {
  if (auth) return onAuthStateChanged(auth, callback);
  try { callback(JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null')); }
  catch { callback(null); }
  const handleStorage = event => {
    if (event.key !== DEMO_SESSION_KEY) return;
    try { callback(JSON.parse(event.newValue || 'null')); }
    catch { callback(null); }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export function getStoredDemoSession() {
  try { return JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null'); }
  catch { return null; }
}

export async function signOutUser() {
  if (auth) await signOut(auth);
  else localStorage.removeItem(DEMO_SESSION_KEY);
}

export async function authenticateWithFirebase({ mode, email, password, role, name }) {
  if (!auth) return authenticateDemoAccount({ mode, email, password, role, name });
  const result = mode === 'signup'
    ? await createUserWithEmailAndPassword(auth, email, password)
    : await signInWithEmailAndPassword(auth, email, password);
  if (mode === 'signup') await updateProfile(result.user, { displayName: name.trim() });
  return result.user;
}
