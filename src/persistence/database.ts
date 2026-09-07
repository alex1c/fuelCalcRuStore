/**
 * Opens the app database and runs schema migrations.
 * Native SQLite is only touched at runtime — domain tests stay pure.
 *
 * Android note (expo-sqlite 57 / Dispatchers.IO):
 * Concurrent prepareAsync/finalize on one NativeDatabase can corrupt SharedObject
 * handles ("2nd argument cannot be cast to NativeStatement (received Integer)").
 * All repository work must go through `withDatabase` so native calls stay serial.
 */

import * as SQLite from 'expo-sqlite'
import { enqueueDbOperation, resetDbOperationQueue } from './db-operation-queue'
import { migrateDatabase } from './migrations'

const DB_NAME = 'auto-journal.db'

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
	if (!databasePromise) {
		databasePromise = (async () => {
			const db = await SQLite.openDatabaseAsync(DB_NAME)
			await db.execAsync('PRAGMA foreign_keys = ON;')
			// Migrations run once during open, before any withDatabase caller races.
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

export { enqueueDbOperation } from './db-operation-queue'

/**
 * Runs a database operation exclusively.
 * Nested `withDatabase` calls from within an already-queued operation are not
 * supported — keep each repository call as one flat `withDatabase` unit.
 */
export function withDatabase<T>(
	operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
	return enqueueDbOperation(async () => {
		const db = await getDatabase()
		return operation(db)
	})
}

/** Test helper — resets the singleton between isolated runs if needed. */
export function resetDatabaseSingleton(): void {
	databasePromise = null
	resetDbOperationQueue()
}
