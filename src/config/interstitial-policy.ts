/**
 * Centralized interstitial frequency policy (single place to tune later).
 *
 * Conservative V1:
 * - at least MIN_SESSIONS completed app sessions
 * - at most one interstitial per COOLDOWN_MS
 * - never from save / backup / restore / form flows (enforced by call sites)
 */

export const INTERSTITIAL_MIN_SESSIONS = 3
export const INTERSTITIAL_COOLDOWN_MS = 24 * 60 * 60 * 1000

export interface InterstitialPolicyState {
	/** Completed app sessions (incremented once per cold start bootstrap). */
	sessionCount: number
	/** Epoch ms of last successful interstitial show, or null. */
	lastShownAtMs: number | null
	nowMs: number
}

export type InterstitialPolicyDecision =
	| { allowed: true }
	| {
			allowed: false
			reason: 'below_min_sessions' | 'cooldown' | 'disabled'
	  }

/**
 * Pure gate — UI and AdService ask this before loading/showing interstitial.
 */
export function evaluateInterstitialPolicy(
	state: InterstitialPolicyState,
	options: { enabled?: boolean } = {},
): InterstitialPolicyDecision {
	if (options.enabled === false) {
		return { allowed: false, reason: 'disabled' }
	}

	if (state.sessionCount < INTERSTITIAL_MIN_SESSIONS) {
		return { allowed: false, reason: 'below_min_sessions' }
	}

	if (
		state.lastShownAtMs !== null &&
		state.nowMs - state.lastShownAtMs < INTERSTITIAL_COOLDOWN_MS
	) {
		return { allowed: false, reason: 'cooldown' }
	}

	return { allowed: true }
}

/** True when a journal "save" flow must never request interstitial. */
export function isProtectedNoAdFlow(flow: string): boolean {
	const protectedFlows = new Set([
		'fuel_save',
		'expense_save',
		'maintenance_save',
		'backup',
		'restore',
		'app_open',
		'notification_open',
	])
	return protectedFlows.has(flow)
}
