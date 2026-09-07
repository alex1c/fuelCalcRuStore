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
				icon: './assets/autojournal-icon.png',
				color: '#0B4FA3',
			},
		],
	]

	if (!isProduction) {
		plugins.splice(1, 0, 'expo-dev-client')
	} else {
		plugins.push('./scripts/with-release-signing.js')
	}

	return {
		...config,
		name: 'Автожурнал',
		slug: 'auto-journal',
		version: '1.0.1',
		orientation: 'portrait',
		icon: './assets/autojournal-icon.png',
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
			versionCode: 2,
			adaptiveIcon: {
				backgroundColor: '#0B4FA3',
				foregroundImage: './assets/autojournal-adaptive-foreground.png',
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
			splashAsset: './assets/autojournal-icon.png',
		},
	}
}
