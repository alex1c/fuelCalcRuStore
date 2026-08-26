/**
 * Opens the app database and runs schema migrations.
 * Native SQLite is only touched at runtime — domain tests stay pure.
 */

import * as SQLite from 'expo-sqlite'
import { migrateDatabase } from './migrations'

const DB_NAME = 'auto-journal.db'

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
	if (!databasePromise) {
		databasePromise = (async () => {
			const db = await SQLite.openDatabaseAsync(DB_NAME)
			await db.execAsync('PRAGMA foreign_keys = ON;')
			await migrateDatabase({
				execAsync: (sql) => db.execAsync(sql),
				getFirstAsync: (sql, params = []) =>
					db.getFirstAsync(sql, params as SQLite.SQLiteBindValue[]),
				runAsync: (sql, params = []) =>
					db.runAsync(sql, params as SQLite.SQLiteBindValue[]),
				withTransaction: async (fn) => {
					// expo-sqlite transaction API returns void; re-run apply result ourselves.
					let result: unknown
					await db.withTransactionAsync(async () => {
						result = await fn()
					})
					return result as never
				},
			})
			return db
		})()
	}

	return databasePromise
}

/** Test helper — resets the singleton between isolated runs if needed. */
export function resetDatabaseSingleton(): void {
	databasePromise = null
}
