import { Capacitor } from '@capacitor/core';

/**
 * Resolves an internal API endpoint path (e.g., '/api/ai/chat') against
 * an optional configured HTTPS backend URL (VITE_API_BASE_URL).
 *
 * - On the web (or when VITE_API_BASE_URL is unset), preserves relative API paths ('/api/...').
 * - When VITE_API_BASE_URL is configured (e.g. for the Android Capacitor WebView),
 *   prepends the normalized HTTPS base URL.
 * - Never invents a fallback production URL or exposes API keys.
 */
export function resolveApiUrl(path: string, configuredBaseUrl?: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const rawBase = (configuredBaseUrl ?? '').trim().replace(/\/+$/, '');

  if (
    !rawBase ||
    rawBase === 'MY_APP_URL' ||
    rawBase.includes('your-production-backend')
  ) {
    return cleanPath;
  }

  return `${rawBase}${cleanPath}`;
}

/**
 * Reads VITE_API_BASE_URL from Vite's client environment if available.
 */
export function getConfiguredApiBaseUrl(): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    return (metaEnv?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Returns true when running inside a native Capacitor container (Android/iOS).
 */
export function isNativeAppPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Returns true if running in a native Capacitor WebView without a configured VITE_API_BASE_URL.
 */
export function isNativeBackendUnconfigured(): boolean {
  return isNativeAppPlatform() && !getConfiguredApiBaseUrl();
}

/**
 * Resolves an API path using the environment's VITE_API_BASE_URL.
 */
export function apiUrl(path: string): string {
  const baseUrl = getConfiguredApiBaseUrl();
  return resolveApiUrl(path, baseUrl);
}

/**
 * Pure helper for Android hardware back-button priority resolution.
 * Ensures highest-priority modals/drawers close first, secondary views navigate back,
 * non-dashboard tabs return to Dashboard, and app exits only from Dashboard with no overlays.
 */
export interface BackNavigationState {
  isAITutorOpen: boolean;
  isSyllabusDiffOpen: boolean;
  hasSelectedTopic: boolean;
  isMobileMoreMenuOpen: boolean;
  isMusicPlayerExpanded: boolean;
  isMusicPlayerOpen: boolean;
  activeTab: string;
}

export type BackNavigationAction =
  | 'close_ai_tutor'
  | 'close_syllabus_diff'
  | 'close_topic_modal'
  | 'close_mobile_more_menu'
  | 'collapse_music_player'
  | 'close_music_player'
  | 'navigate_to_syllabus'
  | 'navigate_to_dashboard'
  | 'exit_app';

export function resolveAndroidBackAction(state: BackNavigationState): BackNavigationAction {
  if (state.isAITutorOpen) return 'close_ai_tutor';
  if (state.isSyllabusDiffOpen) return 'close_syllabus_diff';
  if (state.hasSelectedTopic) return 'close_topic_modal';
  if (state.isMobileMoreMenuOpen) return 'close_mobile_more_menu';
  if (state.isMusicPlayerExpanded) return 'collapse_music_player';
  if (state.isMusicPlayerOpen) return 'close_music_player';
  if (state.activeTab === 'import-syllabus' || state.activeTab === 'syllabus_import') {
    return 'navigate_to_syllabus';
  }
  if (state.activeTab !== 'dashboard' && state.activeTab !== 'home') {
    return 'navigate_to_dashboard';
  }
  return 'exit_app';
}
