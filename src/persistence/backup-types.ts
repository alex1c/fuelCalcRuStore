/**
 * Versioned JSON backup document — full restore format (not CSV).
 */

import type { Expense } from '@/domain/expenses/types'
import type { FuelEntry } from '@/domain/fuel/types'
import type { MaintenanceItem } from '@/domain/maintenance/types'
import type { Vehicle } from '@/domain/vehicle/types'

export const BACKUP_FORMAT = 'auto-journal-backup' as const
export const BACKUP_VERSION = 1 as const

export interface AppSettings {
	currencyCode: 'RUB'
	activeVehicleId?: string
}

export interface AutoJournalBackupV1 {
	format: typeof BACKUP_FORMAT
	version: typeof BACKUP_VERSION
	createdAt: string
	appVersion: string
	vehicles: Vehicle[]
	fuelEntries: FuelEntry[]
	expenses: Expense[]
	maintenance: MaintenanceItem[]
	settings: AppSettings
}

/** Any supported backup document after migration to current schema. */
export type AutoJournalBackup = AutoJournalBackupV1

export function createEmptyBackup(
	appVersion: string,
	createdAt: string,
): AutoJournalBackupV1 {
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		createdAt,
		appVersion,
		vehicles: [],
		fuelEntries: [],
		expenses: [],
		maintenance: [],
		settings: {
			currencyCode: 'RUB',
		},
	}
}

/**
 * Suggested share/save file name: auto-journal-backup-YYYY-MM-DD-HHmm.json
 */
export function backupFileName(dateIso: string): string {
	const date = new Date(dateIso)
	if (Number.isNaN(date.getTime())) {
		return 'auto-journal-backup-unknown.json'
	}
	// UTC stamp keeps filenames deterministic across devices.
	const stamp = date
		.toISOString()
		.slice(0, 16)
		.replace('T', '-')
		.replace(':', '')
	return `auto-journal-backup-${stamp}.json`
}
