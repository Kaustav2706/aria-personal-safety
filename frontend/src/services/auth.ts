/**
 * ARIA Auth Service — JWT Token Management
 * Handles token persistence in localStorage and user session state.
 */

const TOKEN_KEY = 'aria_jwt_token';
const REFRESH_TOKEN_KEY = 'aria_refresh_token';
const USER_KEY = 'aria_user';

/** Store JWT token */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Retrieve JWT token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Remove JWT token */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Store refresh token */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/** Retrieve refresh token */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** Remove refresh token */
export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Store user profile object */
export function setUser(user: Record<string, any>): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Retrieve user profile object */
export function getUser(): Record<string, any> | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Remove user profile */
export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

/** Check if user is authenticated */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Full logout — clears all auth state */
export function logout(): void {
  clearToken();
  clearRefreshToken();
  clearUser();
}
