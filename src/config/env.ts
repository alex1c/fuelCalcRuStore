/**
 * Typed access to public environment variables.
 *
 * AppMetrica API key and Yandex ad unit IDs are client-embedded identifiers
 * (not private server secrets). Keep production values out of git via local
 * `.env` / CI injection — never commit real keys or production unit IDs.
 */

export const env = {
	/**
	 * When true, DevAnalyticsService logs events to the console.
	 * Defaults to true in `__DEV__`.
	 */
	analyticsDevMode:
		process.env.EXPO_PUBLIC_ANALYTICS_DEV_MODE === 'true' || __DEV__,

	/**
	 * AppMetrica application API key from the AppMetrica console.
	 * Empty / placeholder → DevAnalyticsService (no native activate).
	 */
	appMetricaApiKey: process.env.EXPO_PUBLIC_APPMETRICA_API_KEY ?? '',

	/**
	 * Production Yandex banner ad unit (R-M-…).
	 * Ignored in `__DEV__` — demo-banner-yandex is used instead.
	 */
	yandexAdsBannerUnitId:
		process.env.EXPO_PUBLIC_YANDEX_ADS_BANNER_UNIT_ID ??
		process.env.EXPO_PUBLIC_YANDEX_BANNER_BLOCK_ID ??
		'',

	/**
	 * Production Yandex interstitial ad unit (R-M-…).
	 * Ignored in `__DEV__` — demo-interstitial-yandex is used instead.
	 */
	yandexAdsInterstitialUnitId:
		process.env.EXPO_PUBLIC_YANDEX_ADS_INTERSTITIAL_UNIT_ID ??
		process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_BLOCK_ID ??
		'',
} as const
