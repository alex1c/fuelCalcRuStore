import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Expo app config — Continuous Native Generation entry.
 *
 * Production / RuStore (later phases):
 *   APP_VARIANT=production
 *
 * Phase 0–1: no ads, analytics, or extra permissions.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
	const isProduction = process.env.APP_VARIANT === 'production'

	const plugins: NonNullable<ExpoConfig['plugins']> = [
		'expo-router',
		'expo-sqlite',
	]

	if (!isProduction) {
		plugins.splice(1, 0, 'expo-dev-client')
	}

	return {
		...config,
		name: 'Автожурнал',
		slug: 'auto-journal',
		version: '0.1.0',
		orientation: 'portrait',
		icon: './assets/icon.png',
		userInterfaceStyle: 'light',
		scheme: 'auto-journal',
		experiments: {
			typedRoutes: false,
		},
		ios: {
			supportsTablet: true,
			bundleIdentifier: 'com.calculatorplatform.autojournal',
		},
		android: {
			package: 'com.calculatorplatform.autojournal',
			versionCode: 1,
			adaptiveIcon: {
				backgroundColor: '#EEF3F8',
				foregroundImage: './assets/android-icon-foreground.png',
				backgroundImage: './assets/android-icon-background.png',
				monochromeImage: './assets/android-icon-monochrome.png',
			},
			predictiveBackGestureEnabled: false,
			...(isProduction
				? {
						blockedPermissions: [
							'android.permission.SYSTEM_ALERT_WINDOW',
						],
					}
				: {}),
		},
		plugins,
		extra: {
			appVariant: isProduction ? 'production' : 'development',
			splashAsset: './assets/splash-icon.png',
		},
	}
}
