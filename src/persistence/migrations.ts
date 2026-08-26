/**
 * SQLite schema migrations for local-first persistence.
 * Schema version starts at 1; upgrades must run before app reads/writes.
 */

export interface SchemaMigration {
	version: number
	/** Human label for logs / debugging. */
	name: string
	sql: string[]
}

/**
 * Migration 1 — core journal tables.
 * Types mirror domain models (integer ml / kopecks, ISO timestamps as TEXT).
 */
export const MIGRATIONS: readonly SchemaMigration[] = [
	{
		version: 1,
		name: 'initial_journal_schema',
		sql: [
			`CREATE TABLE IF NOT EXISTS schema_migrations (
				version INTEGER PRIMARY KEY NOT NULL,
				applied_at TEXT NOT NULL
			);`,
			`CREATE TABLE IF NOT EXISTS vehicles (
				id TEXT PRIMARY KEY NOT NULL,
				display_name TEXT NOT NULL,
				make TEXT,
				model TEXT,
				fuel_type TEXT NOT NULL,
				current_odometer_km INTEGER NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);`,
			`CREATE TABLE IF NOT EXISTS fuel_entries (
				id TEXT PRIMARY KEY NOT NULL,
				vehicle_id TEXT NOT NULL,
				recorded_at TEXT NOT NULL,
				odometer_km INTEGER NOT NULL,
				liters_ml INTEGER NOT NULL,
				total_cost_kopecks INTEGER NOT NULL,
				price_per_liter_kopecks INTEGER NOT NULL,
				full_tank INTEGER NOT NULL CHECK (full_tank IN (0, 1)),
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
			);`,
			`CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_odo
				ON fuel_entries(vehicle_id, odometer_km, recorded_at, id);`,
			`CREATE TABLE IF NOT EXISTS expenses (
				id TEXT PRIMARY KEY NOT NULL,
				vehicle_id TEXT NOT NULL,
				recorded_at TEXT NOT NULL,
				odometer_km INTEGER,
				amount_kopecks INTEGER NOT NULL,
				category TEXT NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
			);`,
			`CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_recorded
				ON expenses(vehicle_id, recorded_at);`,
			`CREATE TABLE IF NOT EXISTS maintenance_items (
				id TEXT PRIMARY KEY NOT NULL,
				vehicle_id TEXT NOT NULL,
				title TEXT NOT NULL,
				last_service_date TEXT,
				last_service_odometer_km INTEGER,
				interval_km INTEGER,
				interval_days INTEGER,
				note TEXT,
				active INTEGER NOT NULL CHECK (active IN (0, 1)),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
			);`,
			`CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY NOT NULL,
				value TEXT NOT NULL
			);`,
		],
	},
	{
		version: 2,
		name: 'maintenance_remind_flag',
		sql: [
			// Local date reminders for maintenance (no GPS/odometer background jobs).
			`ALTER TABLE maintenance_items
				ADD COLUMN remind INTEGER NOT NULL DEFAULT 0;`,
		],
	},
]

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

/**
 * Minimal DB adapter so migrations can be unit-tested without native SQLite.
 */
export interface SqlExecutor {
	execAsync(sql: string): Promise<void>
	getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>
	runAsync(sql: string, params?: unknown[]): Promise<unknown>
	withTransaction?<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Applies pending migrations in order. Safe to call on every app start.
 */
export async function migrateDatabase(db: SqlExecutor): Promise<number> {
	await db.execAsync(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY NOT NULL,
			applied_at TEXT NOT NULL
		);`,
	)

	const row = await db.getFirstAsync<{ version: number }>(
		`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations;`,
	)
	let current = row?.version ?? 0

	for (const migration of MIGRATIONS) {
		if (migration.version <= current) {
			continue
		}

		const apply = async () => {
			for (const statement of migration.sql) {
				await db.execAsync(statement)
			}

			await db.runAsync(
				`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);`,
				[migration.version, new Date().toISOString()],
			)
		}

		if (db.withTransaction) {
			await db.withTransaction(apply)
		} else {
			await apply()
		}

		current = migration.version
	}

	return current
}
