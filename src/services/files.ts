/**
 * File write + system share helpers (Storage Access Framework / share sheet).
 * Avoids legacy READ/WRITE_EXTERNAL_STORAGE permissions.
 */

import { Share, Platform } from 'react-native'
import * as Sharing from 'expo-sharing'
import {
	cacheDirectory,
	EncodingType,
	writeAsStringAsync,
} from 'expo-file-system/legacy'

export type ShareFileResult =
	| { status: 'shared' }
	| { status: 'cancelled' }
	| { status: 'unavailable' }
	| { status: 'failed'; message: string }

export type ShareTextResult =
	| { status: 'shared' }
	| { status: 'cancelled' }
	| { status: 'failed'; message: string }

/** Writes UTF-8 text into the app cache and returns a file:// URI. */
export async function writeCacheFile(
	fileName: string,
	contents: string,
): Promise<string> {
	if (!cacheDirectory) {
		throw new Error('cache_unavailable')
	}
	const uri = `${cacheDirectory}${fileName}`
	await writeAsStringAsync(uri, contents, {
		encoding: EncodingType.UTF8,
	})
	return uri
}

/** Opens the Android/iOS share sheet for a local file. */
export async function shareLocalFile(
	uri: string,
	options: { mimeType: string; dialogTitle: string },
): Promise<ShareFileResult> {
	try {
		const available = await Sharing.isAvailableAsync()
		if (!available) {
			return { status: 'unavailable' }
		}
		await Sharing.shareAsync(uri, {
			mimeType: options.mimeType,
			dialogTitle: options.dialogTitle,
		})
		return { status: 'shared' }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'share_failed'
		if (/cancel|dismiss|abort/i.test(message)) {
			return { status: 'cancelled' }
		}
		return { status: 'failed', message }
	}
}

/** Shares plain text via the system share sheet. */
export async function sharePlainText(
	message: string,
	title = 'Автожурнал',
): Promise<ShareTextResult> {
	try {
		const result = await Share.share(
			Platform.OS === 'android'
				? { message, title }
				: { message, title },
		)
		if (result.action === Share.dismissedAction) {
			return { status: 'cancelled' }
		}
		return { status: 'shared' }
	} catch (error) {
		return {
			status: 'failed',
			message: error instanceof Error ? error.message : 'share_failed',
		}
	}
}
