import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
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
const app = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;
const persistenceReady = auth ? setPersistence(auth, browserLocalPersistence) : Promise.resolve();

const DEMO_ACCOUNTS_KEY = 'vitra:demo-accounts';
const DEMO_SESSION_KEY = 'vitra:demo-session';
const DEMO_PASSWORD_ITERATIONS = 120000;

function readDemoAccounts() {
  try { return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}'); }
  catch { return {}; }
}
function encodeBytes(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function decodeBytes(value) { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
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
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const profile = { email: normalizedEmail, name: name.trim(), role, salt: encodeBytes(salt), passwordHash: await derivePasswordHash(password, salt) };
    accounts[normalizedEmail] = profile;
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
    const user = makeDemoUser(profile);
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('vitra-auth-change', { detail: user }));
    return user;
  }
  const profile = accounts[normalizedEmail];
  if (!profile || !globalThis.crypto?.subtle) throw new Error('Email or password is incorrect.');
  const submittedHash = await derivePasswordHash(password, decodeBytes(profile.salt));
  if (submittedHash !== profile.passwordHash) throw new Error('Email or password is incorrect.');
  if (profile.role !== role) throw new Error(`This account is set up for the ${profile.role} workspace. Choose that role to sign in.`);
  const user = makeDemoUser(profile);
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('vitra-auth-change', { detail: user }));
  return user;
}

export function watchAuthState(callback) {
  if (auth) return onAuthStateChanged(auth, callback);
  callback(getStoredDemoSession());
  const handleStorage = event => {
    if (event.key === DEMO_SESSION_KEY) callback(getStoredDemoSession());
  };
  const handleLocalChange = event => callback(event.detail || null);
  window.addEventListener('storage', handleStorage);
  window.addEventListener('vitra-auth-change', handleLocalChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('vitra-auth-change', handleLocalChange);
  };
}

export function getStoredDemoSession() {
  try { return JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function getCurrentUser() { return auth?.currentUser || getStoredDemoSession(); }
export async function signOutUser() {
  if (auth) await signOut(auth);
  else {
    localStorage.removeItem(DEMO_SESSION_KEY);
    window.dispatchEvent(new CustomEvent('vitra-auth-change', { detail: null }));
  }
}
export async function authenticateWithFirebase({ mode, email, password, role, name }) {
  if (!auth) return authenticateDemoAccount({ mode, email, password, role, name });
  await persistenceReady;
  const normalizedEmail = email.trim().toLowerCase();
  const result = mode === 'signup'
    ? await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    : await signInWithEmailAndPassword(auth, normalizedEmail, password);
  if (mode === 'signup') await updateProfile(result.user, { displayName: name.trim() });
  return result.user;
}

export function friendlyAuthError(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already uses this email. Choose “Sign in” instead.',
    'auth/invalid-credential': 'Email or password is incorrect. Check both and try again.',
    'auth/user-not-found': 'No account was found for this email. Create an account first.',
    'auth/wrong-password': 'Email or password is incorrect. Check both and try again.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a little while, then try again.',
    'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email and password sign-in is disabled for this Firebase project. Enable it in Authentication sign-in providers.',
  };
  return messages[error?.code] || error?.message || 'Unable to authenticate. Please try again.';
}
