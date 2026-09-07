/**
 * Local persistence helpers for interstitial frequency policy.
 */

import { withDatabase } from '@/persistence/database'

const SESSION_COUNT_KEY = 'ad_session_count'
const LAST_INTERSTITIAL_KEY = 'ad_interstitial_last_shown_at'

async function getSetting(key: string): Promise<string | undefined> {
	return withDatabase(async (db) => {
		const row = await db.getFirstAsync<{ value: string }>(
			`SELECT value FROM settings WHERE key = ?;`,
			[key],
		)
		return row?.value
	})
}

async function setSetting(key: string, value: string): Promise<void> {
	return withDatabase(async (db) => {
		await db.runAsync(
			`INSERT INTO settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
			[key, value],
		)
	})
}

export async function getAdSessionCount(): Promise<number> {
	const raw = await getSetting(SESSION_COUNT_KEY)
	const parsed = Number.parseInt(raw ?? '0', 10)
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/** Increments once per app bootstrap (cold start). */
export async function incrementAdSessionCount(): Promise<number> {
	const next = (await getAdSessionCount()) + 1
	await setSetting(SESSION_COUNT_KEY, String(next))
	return next
}

export async function getLastInterstitialShownAtMs(): Promise<number | null> {
	const raw = await getSetting(LAST_INTERSTITIAL_KEY)
	if (!raw) {
		return null
	}
	const parsed = Number.parseInt(raw, 10)
	return Number.isFinite(parsed) ? parsed : null
}

export async function setLastInterstitialShownAtMs(ms: number): Promise<void> {
	await setSetting(LAST_INTERSTITIAL_KEY, String(ms))
}
