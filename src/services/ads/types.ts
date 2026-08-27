import type { BannerPlacementId, InterstitialPlacementId } from '@/config/ads-config'

/** Result of attempting to show an interstitial ad. */
export type AdShowResult =
	| { shown: true }
	| { shown: false; reason: 'not_ready' | 'skipped' | 'error' | 'policy' }

/**
 * Advertising boundary — UI depends on this interface, not on Yandex SDK types.
 */
export interface AdService {
	/** Initializes the native ads SDK when available. Fail-open. */
	initialize(): Promise<void>

	/** Preloads interstitial when policy + unit allow. */
	preloadInterstitial(placement?: InterstitialPlacementId): Promise<void>

	/**
	 * Shows interstitial only when frequency policy allows.
	 * Never call from fuel/expense/maintenance save or backup/restore.
	 */
	showInterstitial(placement: InterstitialPlacementId): Promise<AdShowResult>

	/** Whether the product may render a banner for this placement. */
	shouldShowBanner(placement: BannerPlacementId): boolean

	/** Resolved ad unit id for BannerView, or null when disabled. */
	getBannerAdUnitId(placement: BannerPlacementId): string | null
}

export type { BannerPlacementId, InterstitialPlacementId }
