/**
 * Yandex ad unit resolution + product placement policy.
 */

import { env } from '@/config/env'

/** Official Yandex demo units — test creatives only, no paid traffic. */
export const YANDEX_DEMO_BANNER_UNIT_ID = 'demo-banner-yandex'
export const YANDEX_DEMO_INTERSTITIAL_UNIT_ID = 'demo-interstitial-yandex'

/**
 * Product banner placements (share one banner unit id).
 * `shell_banner` is the single bottom slot under the navigator.
 */
export type BannerPlacementId = 'shell_banner'

export type InterstitialPlacementId = 'stats_open'

export type AdPlacementId = BannerPlacementId | InterstitialPlacementId

export const PRODUCT_BANNER_PLACEMENTS: readonly BannerPlacementId[] = [
	'shell_banner',
] as const

/** Max height (dp) for inline adaptive banners. */
export const BANNER_MAX_HEIGHT_DP = 90

const YANDEX_PRODUCTION_UNIT_ID_PATTERN = /^R-M-\d+-\d+$/

function isJestRuntime(): boolean {
	return typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined
}

function trimUnitId(value: string): string {
	return value.trim()
}

/** Accept only partner-console unit IDs in production; malformed → ads off. */
export function resolveConfiguredProductionUnitId(value: string): string | null {
	const configured = trimUnitId(value)
	return YANDEX_PRODUCTION_UNIT_ID_PATTERN.test(configured) ? configured : null
}

export function isProductBannerPlacement(
	placement: string,
): placement is BannerPlacementId {
	return (PRODUCT_BANNER_PLACEMENTS as readonly string[]).includes(placement)
}

/** Resolves banner ad unit for current runtime (demo in __DEV__/Jest). */
export function resolveBannerAdUnitId(): string | null {
	if (__DEV__ || isJestRuntime()) {
		return YANDEX_DEMO_BANNER_UNIT_ID
	}
	return resolveConfiguredProductionUnitId(env.yandexAdsBannerUnitId)
}

/** Resolves interstitial ad unit for current runtime. */
export function resolveInterstitialAdUnitId(): string | null {
	if (__DEV__ || isJestRuntime()) {
		return YANDEX_DEMO_INTERSTITIAL_UNIT_ID
	}
	return resolveConfiguredProductionUnitId(env.yandexAdsInterstitialUnitId)
}

export function isBannerConfigured(): boolean {
	return resolveBannerAdUnitId() !== null
}

export function isInterstitialConfigured(): boolean {
	return resolveInterstitialAdUnitId() !== null
}
