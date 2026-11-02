/**
 * Central API Configuration & Routing Helper
 * Automatically handles routing when hosted on GitHub Pages or static hosts.
 */

export const CLOUD_RUN_API_BASE = 'https://ais-dev-m5xxmnbj3ov6ar4hzgxzgc-136240641802.asia-east1.run.app';

/**
 * Returns the active API base URL.
 * - On same-origin hosting (Cloud Run, local dev): returns '' (relative paths).
 * - On GitHub Pages (*.github.io), static hosting, or external domains: returns the deployed backend URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // Custom environment override if defined
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl) {
    return String(envUrl).replace(/\/+$/, '');
  }

  const hostname = window.location.hostname.toLowerCase();

  // Check if hosted on GitHub Pages or external static host
  const isStaticExternalHost =
    hostname.includes('github.io') ||
    hostname.includes('pages.dev') ||
    hostname.includes('netlify.app') ||
    hostname.includes('vercel.app') ||
    window.location.protocol === 'file:';

  if (isStaticExternalHost) {
    return CLOUD_RUN_API_BASE;
  }

  // Same-origin execution
  return '';
}

/**
 * Generates an absolute or relative API URL depending on current environment.
 * @param path Endpoint path, e.g. '/api/xtream/authenticate'
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${cleanPath}`;
}
