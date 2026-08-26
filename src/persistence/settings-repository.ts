import { getDatabase } from './database'

const ACTIVE_VEHICLE_KEY = 'activeVehicleId'

export async function getActiveVehicleId(): Promise<string | undefined> {
	const db = await getDatabase()
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM settings WHERE key = ?;`,
		[ACTIVE_VEHICLE_KEY],
	)
	return row?.value
}

export async function setActiveVehicleId(vehicleId: string | null): Promise<void> {
	const db = await getDatabase()

	if (!vehicleId) {
		await db.runAsync(`DELETE FROM settings WHERE key = ?;`, [ACTIVE_VEHICLE_KEY])
		return
	}

	await db.runAsync(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
		[ACTIVE_VEHICLE_KEY, vehicleId],
	)
}
