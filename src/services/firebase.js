import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  setPersistence,
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

export function watchAuthState(callback) {
  return auth ? onAuthStateChanged(auth, callback) : () => {};
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}

export async function authenticateWithFirebase({ mode, email, password, role }) {
  if (!auth) throw new Error('Account sign-in is not configured. Add the Firebase web app settings to .env.local and restart Vite.');
  await persistenceReady;
  const normalizedEmail = email.trim().toLowerCase();
  const result = mode === 'signup'
    ? await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    : await signInWithEmailAndPassword(auth, normalizedEmail, password);
  if (mode === 'signup') await updateProfile(result.user, { displayName: role });
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
