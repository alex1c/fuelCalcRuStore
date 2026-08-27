/**
 * Jest stub for yandex-mobile-ads — unit tests must never touch the native SDK.
 */
class FakeBannerAdSize {
	width = 320
	height = 50
	initialWidth = 320
	initialHeight = 50
	widthInPixels = 320
	heightInPixels = 50
	type = 'inline'

	static async stickySize(width) {
		const size = new FakeBannerAdSize()
		size.width = width
		return size
	}

	static async inlineSize(width, _maxHeight) {
		const size = new FakeBannerAdSize()
		size.width = width
		size.height = 50
		return size
	}
}

function FakeBannerView() {
	return null
}

const MobileAds = {
	pluginVersion: 'test',
	initialize: async () => undefined,
	setLocationConsent: () => undefined,
	setAgeRestrictedUser: () => undefined,
	setUserConsent: () => undefined,
	enableLogging: () => undefined,
	enableDebugErrorIndicator: () => undefined,
	showDebugPanel: () => undefined,
	getLibraryVersion: () => 'test',
}

class InterstitialAd {
	onAdShown = () => {}
	onAdFailedToShow = () => {}
	onAdDismissed = () => {}
	onAdClicked = () => {}
	onAdImpression = () => {}
	async show() {}
}

class InterstitialAdLoader {
	static async create() {
		return new InterstitialAdLoader()
	}

	async loadAd() {
		return new InterstitialAd()
	}
}

class RewardedAd {
	onAdShown = () => {}
	onAdFailedToShow = () => {}
	onAdDismissed = () => {}
	onAdClicked = () => {}
	onAdImpression = () => {}
	onRewarded = () => {}
	async show() {}
}

class RewardedAdLoader {
	static async create() {
		return new RewardedAdLoader()
	}

	async loadAd() {
		return new RewardedAd()
	}
}

module.exports = {
	MobileAds,
	BannerView: FakeBannerView,
	BannerAdSize: FakeBannerAdSize,
	InterstitialAd,
	InterstitialAdLoader,
	RewardedAd,
	RewardedAdLoader,
	AppOpenAd: class {},
	AppOpenAdLoader: class {
		static async create() {
			return new this()
		}
	},
}
