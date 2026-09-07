/**
 * Atomic REPLACE ALL restore of a validated backup.
 * Clears user tables inside a transaction, then inserts in FK-safe order.
 */

import type { Expense } from '@/domain/expenses/types'
import type { FuelEntry } from '@/domain/fuel/types'
import type { MaintenanceItem } from '@/domain/maintenance/types'
import type { Vehicle } from '@/domain/vehicle/types'
import type { AutoJournalBackupV1 } from '@/persistence/backup-types'

export type RestoreResult =
	| { ok: true }
	| { ok: false; message: string }

/** Minimal DB surface used by restore (injectable for tests). */
export interface RestoreDatabase {
	withTransactionAsync(fn: () => Promise<void>): Promise<void>
	execAsync(sql: string): Promise<void>
	runAsync(sql: string, params?: unknown[]): Promise<unknown>
}

/**
 * Replaces all user journal data with the backup contents.
 * Caller must validate beforehand. On error, transaction rolls back.
 */
export async function restoreBackupReplaceAll(
	backup: AutoJournalBackupV1,
	db?: RestoreDatabase,
): Promise<RestoreResult> {
	const run = async (database: RestoreDatabase): Promise<RestoreResult> => {
		try {
			await database.withTransactionAsync(async () => {
				await database.execAsync('DELETE FROM fuel_entries;')
				await database.execAsync('DELETE FROM expenses;')
				await database.execAsync('DELETE FROM maintenance_items;')
				await database.execAsync('DELETE FROM settings;')
				await database.execAsync('DELETE FROM vehicles;')

				for (const vehicle of backup.vehicles) {
					await insertVehicle(database, vehicle)
				}
				for (const entry of backup.fuelEntries) {
					await insertFuel(database, entry)
				}
				for (const expense of backup.expenses) {
					await insertExpense(database, expense)
				}
				for (const item of backup.maintenance) {
					await insertMaintenance(database, item)
				}

				if (backup.settings.activeVehicleId) {
					await database.runAsync(
						`INSERT INTO settings (key, value) VALUES (?, ?);`,
						['activeVehicleId', backup.settings.activeVehicleId],
					)
				}
			})
			return { ok: true }
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'restore_failed',
			}
		}
	}

	// Injected DB (unit tests) bypasses the native serial queue.
	if (db) {
		return run(db)
	}

	// Production path: hold the SQLite queue for the whole REPLACE ALL transaction.
	const { withDatabase } = await import('@/persistence/database')
	return withDatabase((nativeDb) =>
		run(nativeDb as unknown as RestoreDatabase),
	)
}

async function insertVehicle(
	db: RestoreDatabase,
	vehicle: Vehicle,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO vehicles (
			id, display_name, make, model, fuel_type,
			current_odometer_km, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
		[
			vehicle.id,
			vehicle.displayName,
			vehicle.make ?? null,
			vehicle.model ?? null,
			vehicle.fuelType,
			vehicle.currentOdometerKm,
			vehicle.createdAt,
			vehicle.updatedAt,
		],
	)
}

async function insertFuel(db: RestoreDatabase, entry: FuelEntry): Promise<void> {
	await db.runAsync(
		`INSERT INTO fuel_entries (
			id, vehicle_id, recorded_at, odometer_km, liters_ml,
			total_cost_kopecks, price_per_liter_kopecks, full_tank,
			note, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		[
			entry.id,
			entry.vehicleId,
			entry.recordedAt,
			entry.odometerKm,
			entry.litersMl,
			entry.totalCostKopecks,
			entry.pricePerLiterKopecks,
			entry.fullTank ? 1 : 0,
			entry.note ?? null,
			entry.createdAt,
			entry.updatedAt,
		],
	)
}

async function insertExpense(
	db: RestoreDatabase,
	expense: Expense,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO expenses (
			id, vehicle_id, recorded_at, odometer_km, amount_kopecks,
			category, note, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		[
			expense.id,
			expense.vehicleId,
			expense.recordedAt,
			expense.odometerKm ?? null,
			expense.amountKopecks,
			expense.category,
			expense.note ?? null,
			expense.createdAt,
			expense.updatedAt,
		],
	)
}

async function insertMaintenance(
	db: RestoreDatabase,
	item: MaintenanceItem,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO maintenance_items (
			id, vehicle_id, title, last_service_date, last_service_odometer_km,
			interval_km, interval_days, note, active, remind, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		[
			item.id,
			item.vehicleId,
			item.title,
			item.lastServiceDate ?? null,
			item.lastServiceOdometerKm ?? null,
			item.intervalKm ?? null,
			item.intervalDays ?? null,
			item.note ?? null,
			item.active ? 1 : 0,
			item.remind ? 1 : 0,
			item.createdAt,
			item.updatedAt,
		],
	)
}
