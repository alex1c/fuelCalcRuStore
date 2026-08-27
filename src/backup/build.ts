/**
 * Builds a versioned backup from current SQLite journal data.
 * Excludes derived consumption / cached statistics.
 */

import {
	createEmptyBackup,
	type AutoJournalBackupV1,
} from '@/persistence/backup-types'
import {
	getActiveVehicleId,
	listExpenses,
	listFuelEntries,
	listMaintenance,
	listVehicles,
} from '@/persistence'
import { backupPreviewCounts, serializeBackup } from './serialize'

/** App version stamped into backups (matches Expo config). */
const APP_VERSION = '1.0.0'

export async function buildBackupFromDatabase(
	createdAt = new Date().toISOString(),
): Promise<AutoJournalBackupV1> {
	const [vehicles, fuelEntries, expenses, maintenance, activeVehicleId] =
		await Promise.all([
			listVehicles(),
			listFuelEntries(),
			listExpenses(),
			listMaintenance(),
			getActiveVehicleId(),
		])

	const backup = createEmptyBackup(APP_VERSION, createdAt)
	backup.vehicles = vehicles
	backup.fuelEntries = fuelEntries
	backup.expenses = expenses
	backup.maintenance = maintenance
	backup.settings = {
		currencyCode: 'RUB',
		...(activeVehicleId ? { activeVehicleId } : {}),
	}
	return backup
}

export { backupPreviewCounts, serializeBackup }
export type { BackupPreviewCounts } from './serialize'
