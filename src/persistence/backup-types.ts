/**
 * Versioned JSON backup document — restore format for a future UI.
 * CSV is intentionally not used for restore.
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

export function createEmptyBackup(appVersion: string, createdAt: string): AutoJournalBackupV1 {
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

/** Suggested download file name for a future share/export flow. */
export function backupFileName(dateIso: string): string {
	const day = dateIso.slice(0, 10)
	return `auto-journal-backup-${day}.json`
}
