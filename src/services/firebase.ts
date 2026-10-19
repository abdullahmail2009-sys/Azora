import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
    // Only attempt if configured
    if (!firebaseConfig.projectId || firebaseConfig.projectId.includes('remixed')) {
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

/**
 * Safely checks for a pending Google OAuth redirect result once per app lifecycle.
 * Prevents duplicate authentication handling or redirect loops.
 */
export async function checkGoogleRedirectResult(): Promise<FirebaseUser | null> {
  if (redirectResultChecked) return null;
  redirectResultChecked = true;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    console.warn('Google Redirect Result check warning:', err);
    return null;
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  // On native Android/iOS Capacitor WebView, popups may be blocked or unsupported;
  // attempt popup on web first, with a safe redirect fallback for Android WebView.
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (popupErr: any) {
      const code = String(popupErr?.code || '');
      if (
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-closed-by-user'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw popupErr;
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = String(err?.code || '');
    if (
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/popup-blocked'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    console.error('Google Sign In error:', err);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
