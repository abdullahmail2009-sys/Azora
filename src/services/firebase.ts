import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';

// Allow optional environment variable override for authDomain if configured in production/custom hosting,
// while defaulting cleanly to firebase-applet-config.json ("analog-hall-ww2pc.firebaseapp.com").
const resolvedAuthDomain =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN &&
    String((import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN).trim()) ||
  firebaseConfig.authDomain;

const effectiveFirebaseConfig = {
  ...firebaseConfig,
  authDomain: resolvedAuthDomain,
};

const app = getApps().length > 0 ? getApp() : initializeApp(effectiveFirebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Ensure session persistence across page reloads and Android WebView restarts
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase auth persistence fallback:', err);
  });
}

// Explicitly use the firestoreDatabaseId from firebase-applet-config.json as mandated
export const db: Firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface FirebaseAuthDiagnostics {
  projectId: string;
  authDomain: string;
  currentOrigin: string;
  isNativePlatform: boolean;
  isConfigured: boolean;
}

export function getFirebaseAuthDiagnostics(): FirebaseAuthDiagnostics {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  return {
    projectId: effectiveFirebaseConfig.projectId || '',
    authDomain: effectiveFirebaseConfig.authDomain || '',
    currentOrigin,
    isNativePlatform: Capacitor.isNativePlatform(),
    isConfigured: Boolean(
      effectiveFirebaseConfig.projectId &&
        !effectiveFirebaseConfig.projectId.includes('remixed') &&
        effectiveFirebaseConfig.apiKey
    ),
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on startup as mandated in firebase skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    if (!effectiveFirebaseConfig.projectId || effectiveFirebaseConfig.projectId.includes('remixed')) {
      return false;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline or unreachable.');
    }
    return false;
  }
}

let redirectResultChecked = false;

export function formatFirebaseAuthError(err: unknown): string {
  const code = String((err as any)?.code || '').toLowerCase();
  const rawMsg = err instanceof Error ? err.message : String(err || 'Authentication failed');
  const lowerMsg = rawMsg.toLowerCase();

  if (
    code.includes('invalid-action') ||
    code.includes('expired-action-code') ||
    lowerMsg.includes('requested action is invalid') ||
    lowerMsg.includes('invalid action')
  ) {
    return 'The authentication redirect link or session state expired ("The requested action is invalid"). This happens when an OAuth redirect opens in a separate browser or WebView with isolated sessionStorage. Please sign in using the popup window or Email & Password below.';
  }
  if (code === 'auth/unauthorized-domain' || lowerMsg.includes('unauthorized-domain')) {
    const origin = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `Domain "${origin}" is not authorized in Firebase Console yet. Add "${origin}" under Firebase Console → Authentication → Settings → Authorized domains (authDomain: ${effectiveFirebaseConfig.authDomain}). Local study storage remains active.`;
  }
  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    lowerMsg.includes('operation-not-supported-in-this-environment')
  ) {
    return 'WebView/browser storage restricted OAuth popup or third-party cookies in this environment. You can sign in with Email & Password or use JSON Export/Import for backups.';
  }
  if (code === 'auth/popup-blocked' || lowerMsg.includes('popup-blocked')) {
    return 'The sign-in popup window was blocked by your browser or WebView. Please allow popups for this site or sign in with Email & Password.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'The sign-in window was closed before completing authentication. Click Sign In again when ready.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is not enabled yet in your Firebase project. Enable it in Firebase Console → Authentication → Sign-in method, or use Google Sign-In.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Please check your credentials or switch to "Create Account" if you are registering a new account.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please switch to "Sign In" to log in with your existing account.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many unsuccessful sign-in attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while connecting to Firebase Authentication. Check your internet connection — local study data remains safely saved.';
  }
  if (lowerMsg.includes('disallowed_useragent')) {
    return 'Google OAuth blocked an embedded WebView user-agent. Use the updated Android app build or sign in with Email & Password.';
  }
  return `Authentication could not complete (${code || 'auth-error'}): ${rawMsg}`;
}

/**
 * Cleans stale or invalid OAuth/Firebase action parameters from the current URL
 * so the browser never gets stuck in an invalid callback state.
 */
function cleanStaleAuthCallbackUrlParams(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const errorParam = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');
    const modeParam = url.searchParams.get('mode');
    const oobCode = url.searchParams.get('oobCode');

    let detectedCallbackError: string | null = null;
    if (errorParam || errorDesc) {
      detectedCallbackError = formatFirebaseAuthError(
        new Error(errorDesc || errorParam || 'The requested action is invalid')
      );
    } else if (modeParam && !oobCode) {
      detectedCallbackError = formatFirebaseAuthError({
        code: 'auth/invalid-action-code',
        message: 'The requested action is invalid.',
      });
    }

    if (errorParam || errorDesc || (modeParam && !oobCode)) {
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      url.searchParams.delete('mode');
      url.searchParams.delete('oobCode');
      url.searchParams.delete('apiKey');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
    return detectedCallbackError;
  } catch {
    return null;
  }
}

/**
 * Safely checks for a pending Google OAuth redirect result once per app lifecycle.
 * Prevents duplicate authentication handling or redirect loops.
 */
export async function checkGoogleRedirectResult(): Promise<{
  user: FirebaseUser | null;
  error: string | null;
}> {
  if (redirectResultChecked) return { user: null, error: null };
  redirectResultChecked = true;

  const urlCallbackError = cleanStaleAuthCallbackUrlParams();
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      return { user: result.user, error: null };
    }
    return { user: null, error: urlCallbackError };
  } catch (err) {
    const formatted = formatFirebaseAuthError(err);
    console.warn('Google Redirect Result check warning:', formatted);
    return { user: null, error: formatted };
  }
}

/**
 * Initiates Google Sign-In using signInWithPopup.
 * IMPORTANT: Never automatically falls back to signInWithRedirect on failure,
 * because in Android Capacitor WebView (https://localhost) and cross-origin iframes,
 * signInWithRedirect navigates the window to https://<authDomain>/__/auth/handler
 * with isolated sessionStorage, trapping the user on a blank white page saying
 * "The requested action is invalid."
 */
export async function signInWithGoogle(options?: {
  allowRedirectFallback?: boolean;
}): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = String(err?.code || '');
    // Only use signInWithRedirect if explicitly requested outside native/iframe environments
    const isEmbeddedFrame =
      typeof window !== 'undefined' && window.self !== window.top;
    if (
      options?.allowRedirectFallback &&
      !Capacitor.isNativePlatform() &&
      !isEmbeddedFrame &&
      code === 'auth/popup-blocked'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    console.warn('Google Sign-In handled error:', err);
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error('Please enter your email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  } catch (err) {
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function registerWithEmailPassword(
  displayName: string,
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cleanName = displayName.trim();
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
    }
    return cred.user;
  } catch (err) {
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error('Please enter your email address first to receive a password reset link.');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err) {
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
