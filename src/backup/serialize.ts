/**
 * Pure backup JSON helpers (no native / SQLite imports).
 */

import type { AutoJournalBackupV1 } from '@/persistence/backup-types'

/** Pretty-printed JSON for share/save (human-inspectable). */
export function serializeBackup(backup: AutoJournalBackupV1): string {
	return `${JSON.stringify(backup, null, 2)}\n`
}

export interface BackupPreviewCounts {
	createdAt: string
	vehicleCount: number
	fuelCount: number
	expenseCount: number
	maintenanceCount: number
}

export function backupPreviewCounts(
	backup: AutoJournalBackupV1,
): BackupPreviewCounts {
	return {
		createdAt: backup.createdAt,
		vehicleCount: backup.vehicles.length,
		fuelCount: backup.fuelEntries.length,
		expenseCount: backup.expenses.length,
		maintenanceCount: backup.maintenance.length,
	}
}
