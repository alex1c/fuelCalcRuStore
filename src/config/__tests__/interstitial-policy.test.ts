/**
 * Unit tests for interstitial frequency policy (pure, no native SDK).
 */

import {
	INTERSTITIAL_COOLDOWN_MS,
	INTERSTITIAL_MIN_SESSIONS,
	evaluateInterstitialPolicy,
	isProtectedNoAdFlow,
} from '@/config/interstitial-policy'

describe('interstitial frequency policy', () => {
	it('blocks before minimum sessions', () => {
		const decision = evaluateInterstitialPolicy({
			sessionCount: INTERSTITIAL_MIN_SESSIONS - 1,
			lastShownAtMs: null,
			nowMs: 1_000_000,
		})
		expect(decision).toEqual({
			allowed: false,
			reason: 'below_min_sessions',
		})
	})

	it('blocks inside cooldown', () => {
		const now = 10_000_000
		const decision = evaluateInterstitialPolicy({
			sessionCount: INTERSTITIAL_MIN_SESSIONS,
			lastShownAtMs: now - INTERSTITIAL_COOLDOWN_MS + 1,
			nowMs: now,
		})
		expect(decision).toEqual({ allowed: false, reason: 'cooldown' })
	})

	it('allows when sessions and cooldown are satisfied', () => {
		const now = 10_000_000
		const decision = evaluateInterstitialPolicy({
			sessionCount: INTERSTITIAL_MIN_SESSIONS,
			lastShownAtMs: now - INTERSTITIAL_COOLDOWN_MS,
			nowMs: now,
		})
		expect(decision).toEqual({ allowed: true })
	})

	it('never treats save/backup flows as interstitial-safe call sites', () => {
		expect(isProtectedNoAdFlow('fuel_save')).toBe(true)
		expect(isProtectedNoAdFlow('expense_save')).toBe(true)
		expect(isProtectedNoAdFlow('maintenance_save')).toBe(true)
		expect(isProtectedNoAdFlow('backup')).toBe(true)
		expect(isProtectedNoAdFlow('restore')).toBe(true)
		expect(isProtectedNoAdFlow('statistics')).toBe(false)
	})
})
