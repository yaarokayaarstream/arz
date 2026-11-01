import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, firebaseConfig } from '../firebase';

export { auth, firebaseConfig };

export class EmailNotVerifiedError extends Error {
  public email: string;
  constructor(email: string, message?: string) {
    super(
      message ||
        'ईमेल अभी सत्यापित नहीं है। कृपया अपने इनबॉक्स में भेजे गए लिंक पर क्लिक करें।'
    );
    this.name = 'EmailNotVerifiedError';
    this.email = email;
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google Popup (Google automatically verifies email addresses)
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign in with Email and Password
 * Enforces email verification: Throws EmailNotVerifiedError if user.emailVerified is false
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  
  // Reload user object to fetch latest emailVerified status from Firebase server
  await result.user.reload();
  
  if (!result.user.emailVerified) {
    const unverifiedEmail = result.user.email || email.trim();
    // Force sign out immediately so unverified sessions cannot persist
    await signOut(auth);
    throw new EmailNotVerifiedError(
      unverifiedEmail,
      'आपकी ईमेल अभी सत्यापित नहीं है। कृपया लॉग इन करने से पहले अपने इनबॉक्स (या स्पैम फ़ोल्डर) में भेजे गए सत्यापन लिंक पर क्लिक करें।'
    );
  }
  
  return result.user;
}

/**
 * Register new user with Email and Password and send verification email
 * Signs the user out immediately until verification link is clicked.
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<{ user: User; verificationSent: boolean }> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }

  // Send verification link to user's registered email
  await sendEmailVerification(result.user);

  // Immediately sign out so user cannot log in or access features until verified
  await signOut(auth);

  return { user: result.user, verificationSent: true };
}

/**
 * Resend verification email to an unverified user
 */
export async function resendVerificationEmail(email: string, pass: string): Promise<void> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  await sendEmailVerification(result.user);
  await signOut(auth);
}

/**
 * Send Password Reset Email
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribe to auth state changes
 * Filters out unverified email/password accounts
 */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user && !user.emailVerified && user.providerData.some((p) => p.providerId === 'password')) {
      signOut(auth).catch(() => {});
      callback(null);
    } else {
      callback(user);
    }
  });
}
