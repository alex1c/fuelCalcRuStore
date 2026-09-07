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
const APP_VERSION = '1.0.1'

export async function buildBackupFromDatabase(
	createdAt = new Date().toISOString(),
): Promise<AutoJournalBackupV1> {
	const vehicles = await listVehicles()
	const fuelEntries = await listFuelEntries()
	const expenses = await listExpenses()
	const maintenance = await listMaintenance()
	const activeVehicleId = await getActiveVehicleId()

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
