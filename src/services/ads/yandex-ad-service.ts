/**
 * Yandex Mobile Ads adapter — native SDK isolated behind AdService.
 */

import {
	isBannerConfigured,
	isInterstitialConfigured,
	isProductBannerPlacement,
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
	type InterstitialPlacementId,
} from '@/config/ads-config'
import {
	evaluateInterstitialPolicy,
	isProtectedNoAdFlow,
} from '@/config/interstitial-policy'
import { getAnalyticsService } from '@/services/analytics'
import {
	getAdSessionCount,
	getLastInterstitialShownAtMs,
	setLastInterstitialShownAtMs,
} from './ad-policy-store'
import type { AdService, AdShowResult, BannerPlacementId } from './types'

type YandexMobileAdsModule = typeof import('yandex-mobile-ads')

/**
 * Product Yandex ads: banners + rare capped interstitial.
 * Never call interstitial from save/backup/restore paths.
 */
export class YandexAdService implements AdService {
	private sdk: YandexMobileAdsModule | null = null
	private initialized = false
	private initializePromise: Promise<void> | null = null
	private loadedInterstitial: import('yandex-mobile-ads').InterstitialAd | null =
		null
	private interstitialLoading = false

	private loadSdk(): YandexMobileAdsModule | null {
		if (this.sdk) {
			return this.sdk
		}
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			this.sdk = require('yandex-mobile-ads') as YandexMobileAdsModule
			return this.sdk
		} catch {
			return null
		}
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}
		if (this.initializePromise) {
			return this.initializePromise
		}
		this.initializePromise = this.doInitialize()
		return this.initializePromise
	}

	private async doInitialize(): Promise<void> {
		const sdk = this.loadSdk()
		if (!sdk) {
			return
		}
		try {
			sdk.MobileAds.setLocationConsent(false)
			sdk.MobileAds.setAgeRestrictedUser(false)
			await sdk.MobileAds.initialize()
			this.initialized = true
		} catch {
			// Fail open.
		}
	}

	shouldShowBanner(placement: BannerPlacementId): boolean {
		return isProductBannerPlacement(placement) && isBannerConfigured()
	}

	getBannerAdUnitId(placement: BannerPlacementId): string | null {
		if (!isProductBannerPlacement(placement)) {
			return null
		}
		return resolveBannerAdUnitId()
	}

	async preloadInterstitial(
		_placement: InterstitialPlacementId = 'stats_open',
	): Promise<void> {
		if (!isInterstitialConfigured()) {
			return
		}

		const allowed = await this.isPolicyAllowed()
		if (!allowed) {
			return
		}

		if (this.loadedInterstitial || this.interstitialLoading) {
			return
		}

		await this.initialize()
		const sdk = this.loadSdk()
		const adUnitId = resolveInterstitialAdUnitId()
		if (!sdk || !adUnitId) {
			return
		}

		this.interstitialLoading = true
		try {
			const loader = await sdk.InterstitialAdLoader.create()
			this.loadedInterstitial = await loader.loadAd({ adUnitId })
		} catch {
			this.loadedInterstitial = null
		} finally {
			this.interstitialLoading = false
		}
	}

	async showInterstitial(
		placement: InterstitialPlacementId,
	): Promise<AdShowResult> {
		getAnalyticsService().track('ad_interstitial_requested', {
			placement,
			format: 'interstitial',
			mode: 'journal',
		})

		// Defense in depth: save/backup/restore/app_open must never show ads
		// even if a call site bypasses TypeScript placement typing.
		if (isProtectedNoAdFlow(placement)) {
			getAnalyticsService().track('ad_interstitial_skipped', {
				placement,
				format: 'interstitial',
				mode: 'journal',
				error_category: 'policy',
			})
			return { shown: false, reason: 'policy' }
		}

		if (!isInterstitialConfigured()) {
			getAnalyticsService().track('ad_interstitial_skipped', {
				placement,
				format: 'interstitial',
				mode: 'journal',
				error_category: 'unavailable',
			})
			return { shown: false, reason: 'skipped' }
		}

		const allowed = await this.isPolicyAllowed()
		if (!allowed) {
			getAnalyticsService().track('ad_interstitial_skipped', {
				placement,
				format: 'interstitial',
				mode: 'journal',
				error_category: 'policy',
			})
			return { shown: false, reason: 'policy' }
		}

		if (!this.loadedInterstitial) {
			await this.preloadInterstitial(placement)
		}

		const ad = this.loadedInterstitial
		if (!ad) {
			getAnalyticsService().track('ad_interstitial_skipped', {
				placement,
				format: 'interstitial',
				mode: 'journal',
				error_category: 'load',
			})
			return { shown: false, reason: 'not_ready' }
		}

		this.loadedInterstitial = null

		return new Promise<AdShowResult>((resolve) => {
			let settled = false

			const finish = (result: AdShowResult) => {
				if (settled) {
					return
				}
				settled = true
				resolve(result)
			}

			ad.onAdShown = () => {
				void setLastInterstitialShownAtMs(Date.now())
				getAnalyticsService().track('ad_interstitial_shown', {
					placement,
					format: 'interstitial',
					mode: 'journal',
				})
			}

			ad.onAdFailedToShow = () => {
				getAnalyticsService().track('ad_interstitial_skipped', {
					placement,
					format: 'interstitial',
					mode: 'journal',
					error_category: 'show',
				})
				finish({ shown: false, reason: 'error' })
			}

			ad.onAdDismissed = () => {
				finish({ shown: true })
			}

			void ad.show().catch(() => {
				getAnalyticsService().track('ad_interstitial_skipped', {
					placement,
					format: 'interstitial',
					mode: 'journal',
					error_category: 'show',
				})
				finish({ shown: false, reason: 'error' })
			})
		})
	}

	private async isPolicyAllowed(): Promise<boolean> {
		// Sequential on purpose: both reads go through the shared SQLite queue.
		// Promise.all would still be serialized by that queue, but keeping the
		// calls ordered matches the Android prepareAsync hotfix and stays obvious.
		const sessionCount = await getAdSessionCount()
		const lastShownAtMs = await getLastInterstitialShownAtMs()
		const decision = evaluateInterstitialPolicy({
			sessionCount,
			lastShownAtMs,
			nowMs: Date.now(),
		})
		return decision.allowed
	}
}
