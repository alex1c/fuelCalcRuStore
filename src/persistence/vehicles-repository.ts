import type { Vehicle } from '@/domain/vehicle/types'
import { getDatabase } from './database'
import { mapVehicleRow, type VehicleRow } from './mappers'

export async function listVehicles(): Promise<Vehicle[]> {
	const db = await getDatabase()
	const rows = await db.getAllAsync<VehicleRow>(
		`SELECT * FROM vehicles ORDER BY display_name COLLATE NOCASE ASC, created_at ASC;`,
	)
	return rows.map(mapVehicleRow)
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
	const db = await getDatabase()
	const row = await db.getFirstAsync<VehicleRow>(
		`SELECT * FROM vehicles WHERE id = ?;`,
		[id],
	)
	return row ? mapVehicleRow(row) : null
}

export async function upsertVehicle(vehicle: Vehicle): Promise<void> {
	const db = await getDatabase()
	await db.runAsync(
		`INSERT INTO vehicles (
			id, display_name, make, model, fuel_type,
			current_odometer_km, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			display_name = excluded.display_name,
			make = excluded.make,
			model = excluded.model,
			fuel_type = excluded.fuel_type,
			current_odometer_km = excluded.current_odometer_km,
			updated_at = excluded.updated_at;`,
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

export async function deleteVehicle(id: string): Promise<void> {
	const db = await getDatabase()
	await db.runAsync(`DELETE FROM vehicles WHERE id = ?;`, [id])
}
