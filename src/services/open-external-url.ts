/**
 * Opens an https URL through the system handler.
 * Failures become an alert so the UI never sees an unhandled rejection.
 */

import { Alert, Linking } from 'react-native'

const OPEN_FAILED_MESSAGE =
	'Не удалось открыть страницу. Проверьте подключение и попробуйте ещё раз.'

/**
 * Opens `url` with Linking.openURL.
 * canOpenURL is intentionally not used: on Android 11+ it returns false for
 * https unless every browser is declared in the manifest queries list.
 */
export async function openExternalUrl(url: string): Promise<void> {
	try {
		await Linking.openURL(url)
	} catch (err) {
		console.warn('[links] failed to open url', err)
		Alert.alert('Ссылка', OPEN_FAILED_MESSAGE)
	}
}
