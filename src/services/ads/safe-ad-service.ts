import type {
	AdService,
	AdShowResult,
	BannerPlacementId,
	InterstitialPlacementId,
} from './types'

/** Wraps any ad provider so SDK failures never break journal UX. */
export class SafeAdService implements AdService {
	constructor(private readonly inner: AdService) {}

	async initialize(): Promise<void> {
		try {
			await this.inner.initialize()
		} catch {
			// Ads must never block app startup.
		}
	}

	async preloadInterstitial(placement?: InterstitialPlacementId): Promise<void> {
		try {
			await this.inner.preloadInterstitial(placement)
		} catch {
			// Swallow.
		}
	}

	async showInterstitial(
		placement: InterstitialPlacementId,
	): Promise<AdShowResult> {
		try {
			return await this.inner.showInterstitial(placement)
		} catch {
			return { shown: false, reason: 'error' }
		}
	}

	shouldShowBanner(placement: BannerPlacementId): boolean {
		try {
			return this.inner.shouldShowBanner(placement)
		} catch {
			return false
		}
	}

	getBannerAdUnitId(placement: BannerPlacementId): string | null {
		try {
			return this.inner.getBannerAdUnitId(placement)
		} catch {
			return null
		}
	}
}
