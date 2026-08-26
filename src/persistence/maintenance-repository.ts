import type { MaintenanceItem } from '@/domain/maintenance/types'
import { getDatabase } from './database'
import { mapMaintenanceRow, type MaintenanceRow } from './mappers'

export async function listMaintenance(
	vehicleId?: string,
): Promise<MaintenanceItem[]> {
	const db = await getDatabase()

	if (vehicleId) {
		const rows = await db.getAllAsync<MaintenanceRow>(
			`SELECT * FROM maintenance_items
			 WHERE vehicle_id = ?
			 ORDER BY active DESC, title COLLATE NOCASE ASC;`,
			[vehicleId],
		)
		return rows.map(mapMaintenanceRow)
	}

	const rows = await db.getAllAsync<MaintenanceRow>(
		`SELECT * FROM maintenance_items
		 ORDER BY active DESC, title COLLATE NOCASE ASC;`,
	)
	return rows.map(mapMaintenanceRow)
}

export async function getMaintenanceById(
	id: string,
): Promise<MaintenanceItem | null> {
	const db = await getDatabase()
	const row = await db.getFirstAsync<MaintenanceRow>(
		`SELECT * FROM maintenance_items WHERE id = ?;`,
		[id],
	)
	return row ? mapMaintenanceRow(row) : null
}

export async function upsertMaintenance(item: MaintenanceItem): Promise<void> {
	const db = await getDatabase()
	await db.runAsync(
		`INSERT INTO maintenance_items (
			id, vehicle_id, title, last_service_date, last_service_odometer_km,
			interval_km, interval_days, note, active, remind, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			vehicle_id = excluded.vehicle_id,
			title = excluded.title,
			last_service_date = excluded.last_service_date,
			last_service_odometer_km = excluded.last_service_odometer_km,
			interval_km = excluded.interval_km,
			interval_days = excluded.interval_days,
			note = excluded.note,
			active = excluded.active,
			remind = excluded.remind,
			updated_at = excluded.updated_at;`,
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

export async function deleteMaintenance(id: string): Promise<void> {
	const db = await getDatabase()
	await db.runAsync(`DELETE FROM maintenance_items WHERE id = ?;`, [id])
}
