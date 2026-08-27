import type {
	AdService,
	AdShowResult,
	BannerPlacementId,
	InterstitialPlacementId,
} from './types'

function shouldLogDevNoop(): boolean {
	return __DEV__ && process.env.JEST_WORKER_ID === undefined
}

/** Safe development / Jest provider — no SDK, no network. */
export class NoopAdService implements AdService {
	async initialize(): Promise<void> {
		if (shouldLogDevNoop()) {
			console.info('[AdService:noop] initialize skipped')
		}
	}

	async preloadInterstitial(_placement?: InterstitialPlacementId): Promise<void> {
		if (shouldLogDevNoop()) {
			console.info('[AdService:noop] preloadInterstitial skipped')
		}
	}

	async showInterstitial(
		_placement: InterstitialPlacementId,
	): Promise<AdShowResult> {
		if (shouldLogDevNoop()) {
			console.info('[AdService:noop] showInterstitial skipped')
		}
		return { shown: false, reason: 'skipped' }
	}

	shouldShowBanner(_placement: BannerPlacementId): boolean {
		return false
	}

	getBannerAdUnitId(_placement: BannerPlacementId): string | null {
		return null
	}
}
