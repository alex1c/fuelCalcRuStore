import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Expo app config — Continuous Native Generation entry.
 *
 * Production / RuStore:
 *   APP_VARIANT=production
 *
 * Analytics / ads keys: EXPO_PUBLIC_* via `.env` (see `.env.example`).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
	const isProduction = process.env.APP_VARIANT === 'production'

	const plugins: NonNullable<ExpoConfig['plugins']> = [
		'expo-router',
		'expo-sqlite',
		'expo-sharing',
		[
			'expo-notifications',
			{
				icon: './assets/icon.png',
				color: '#1B6CA8',
			},
		],
	]

	if (!isProduction) {
		plugins.splice(1, 0, 'expo-dev-client')
	}

	return {
		...config,
		name: 'Автожурнал',
		slug: 'auto-journal',
		version: '1.0.0',
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
			// Share/SAF + notifications: block legacy storage; keep overlay only in prod.
			blockedPermissions: [
				'android.permission.READ_EXTERNAL_STORAGE',
				'android.permission.WRITE_EXTERNAL_STORAGE',
				'android.permission.MANAGE_EXTERNAL_STORAGE',
				...(isProduction
					? (['android.permission.SYSTEM_ALERT_WINDOW'] as const)
					: []),
			],
		},
		plugins,
		extra: {
			appVariant: isProduction ? 'production' : 'development',
			splashAsset: './assets/splash-icon.png',
		},
	}
}
