import type { FuelEntry } from '@/domain/fuel/types'
import { withDatabase } from './database'
import { mapFuelEntryRow, type FuelEntryRow } from './mappers'

export async function listFuelEntries(vehicleId?: string): Promise<FuelEntry[]> {
	return withDatabase(async (db) => {
		if (vehicleId) {
			const rows = await db.getAllAsync<FuelEntryRow>(
				`SELECT * FROM fuel_entries
				 WHERE vehicle_id = ?
				 ORDER BY odometer_km ASC, recorded_at ASC, id ASC;`,
				[vehicleId],
			)
			return rows.map(mapFuelEntryRow)
		}

		const rows = await db.getAllAsync<FuelEntryRow>(
			`SELECT * FROM fuel_entries
			 ORDER BY odometer_km ASC, recorded_at ASC, id ASC;`,
		)
		return rows.map(mapFuelEntryRow)
	})
}

export async function getFuelEntryById(id: string): Promise<FuelEntry | null> {
	return withDatabase(async (db) => {
		const row = await db.getFirstAsync<FuelEntryRow>(
			`SELECT * FROM fuel_entries WHERE id = ?;`,
			[id],
		)
		return row ? mapFuelEntryRow(row) : null
	})
}

export async function upsertFuelEntry(entry: FuelEntry): Promise<void> {
	return withDatabase(async (db) => {
		await db.runAsync(
			`INSERT INTO fuel_entries (
				id, vehicle_id, recorded_at, odometer_km, liters_ml,
				total_cost_kopecks, price_per_liter_kopecks, full_tank,
				note, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				vehicle_id = excluded.vehicle_id,
				recorded_at = excluded.recorded_at,
				odometer_km = excluded.odometer_km,
				liters_ml = excluded.liters_ml,
				total_cost_kopecks = excluded.total_cost_kopecks,
				price_per_liter_kopecks = excluded.price_per_liter_kopecks,
				full_tank = excluded.full_tank,
				note = excluded.note,
				updated_at = excluded.updated_at;`,
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
	})
}

export async function deleteFuelEntry(id: string): Promise<void> {
	return withDatabase(async (db) => {
		await db.runAsync(`DELETE FROM fuel_entries WHERE id = ?;`, [id])
	})
}
