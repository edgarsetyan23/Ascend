import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

// localStorage: tokens persist across page refreshes and browser restarts.
// This is the Cognito SDK default and standard for web apps.
const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  Storage: localStorage,
});

/** Register a new user with email + password. Triggers verification email. */
export function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })];
    pool.signUp(email, password, attrs, null, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/** Confirm registration with the 6-digit code emailed by Cognito. */
export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: localStorage });
    user.confirmRegistration(code, true, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/** Resend the confirmation code to an unconfirmed account. */
export function resendConfirmationCode(email) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: localStorage });
    user.resendConfirmationCode((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/** Authenticate and return { user: CognitoUser, session: CognitoUserSession }. */
export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: localStorage });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve({ user, session }),
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('Password reset required — contact support')),
    });
  });
}

/** Trigger a password-reset email with a 6-digit code. */
export function forgotPassword(email) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: localStorage })
    user.forgotPassword({
      onSuccess: resolve,
      onFailure: reject,
    })
  })
}

/** Confirm the reset with the emailed code and set a new password. */
export function confirmPassword(email, code, newPassword) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: localStorage })
    user.confirmPassword(code, newPassword, {
      onSuccess: resolve,
      onFailure: reject,
    })
  })
}

/** Sign out the current user and clear in-memory tokens. */
export function signOut() {
  const user = pool.getCurrentUser();
  if (user) user.signOut();
}

/**
 * Attempt to restore an existing session from localStorage.
 * Returns null if no valid session exists or the token is expired.
 */
export function getSession() {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((error, session) => {
      if (error || !session?.isValid()) return resolve(null);
      resolve(session);
    });
  });
}

/** Returns the raw IdToken JWT string, or null if not authenticated. */
export async function getIdToken() {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
}
