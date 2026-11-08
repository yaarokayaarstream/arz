/**
 * Central API Configuration & Routing Helper
 * Automatically handles routing when hosted on GitHub Pages or static hosts.
 */

export const CLOUD_RUN_API_BASE = 'https://ais-pre-m5xxmnbj3ov6ar4hzgxzgc-136240641802.asia-east1.run.app';
export const BACKEND_URL_STORAGE_KEY = 'streamhub_backend_url';

/**
 * Checks if the app is currently running on GitHub Pages or an external static host
 */
export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes('github.io') ||
    hostname.includes('pages.dev') ||
    hostname.includes('netlify.app') ||
    hostname.includes('vercel.app') ||
    window.location.protocol === 'file:'
  );
}

/**
 * Returns any user-specified custom backend proxy URL from localStorage
 */
export function getCustomBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(BACKEND_URL_STORAGE_KEY) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Sets a custom backend proxy URL (e.g. deployed to Cloud Run, Render, Railway, or VPS)
 */
export function setCustomBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (!clean) {
      localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    } else {
      localStorage.setItem(BACKEND_URL_STORAGE_KEY, clean);
    }
  } catch {
    // ignore
  }
}

/**
 * Returns the active API base URL.
 * Priority:
 * 1. User-configured custom backend URL in localStorage
 * 2. VITE_API_BASE_URL environment variable
 * 3. On static hosting (GitHub Pages): default deployed Cloud Run backend
 * 4. Localhost / same-origin: '' (relative paths)
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const custom = getCustomBackendUrl();
  if (custom) {
    return custom;
  }

  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl) {
    return String(envUrl).replace(/\/+$/, '');
  }

  if (isStaticHosting()) {
    return CLOUD_RUN_API_BASE;
  }

  return '';
}

/**
 * Checks if the active backend is reachable
 */
export async function checkBackendHealth(): Promise<{ online: boolean; url: string; latencyMs: number }> {
  const base = getApiBaseUrl();
  const target = base ? `${base}/api/ffmpeg/status` : '/api/ffmpeg/status';
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(target, { signal: controller.signal });
    clearTimeout(timer);
    return {
      online: res.ok,
      url: base || window.location.origin,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      online: false,
      url: base || window.location.origin,
      latencyMs: Date.now() - start,
    };
  }
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
