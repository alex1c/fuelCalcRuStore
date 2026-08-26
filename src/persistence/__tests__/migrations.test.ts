import {
	LATEST_SCHEMA_VERSION,
	MIGRATIONS,
	migrateDatabase,
	type SqlExecutor,
} from '@/persistence/migrations'
import {
	BACKUP_FORMAT,
	BACKUP_VERSION,
	backupFileName,
	createEmptyBackup,
} from '@/persistence/backup-types'

function createMemoryDb(): SqlExecutor & { statements: string[] } {
	const tables = new Map<string, unknown>()
	const applied: number[] = []
	const statements: string[] = []

	return {
		statements,
		async execAsync(sql: string) {
			statements.push(sql)
			if (sql.includes('schema_migrations') && sql.includes('CREATE')) {
				tables.set('schema_migrations', true)
			}
		},
		async getFirstAsync<T>(sql: string) {
			if (sql.includes('MAX(version)')) {
				const version = applied.length === 0 ? 0 : Math.max(...applied)
				return { version } as T
			}
			return null
		},
		async runAsync(sql: string, params: unknown[] = []) {
			statements.push(sql)
			if (sql.includes('INSERT INTO schema_migrations')) {
				applied.push(params[0] as number)
			}
			return undefined
		},
		async withTransaction(fn) {
			return fn()
		},
	}
}

describe('persistence architecture', () => {
	it('defines schema migrations through version 2', () => {
		expect(MIGRATIONS[0].version).toBe(1)
		expect(MIGRATIONS[1].version).toBe(2)
		expect(LATEST_SCHEMA_VERSION).toBe(2)
		expect(MIGRATIONS[0].sql.join('\n')).toContain('fuel_entries')
		expect(MIGRATIONS[1].sql.join('\n')).toContain('remind')
	})

	it('migrateDatabase applies pending versions once', async () => {
		const db = createMemoryDb()
		const version = await migrateDatabase(db)
		expect(version).toBe(2)

		const again = await migrateDatabase(db)
		expect(again).toBe(2)

		const inserts = db.statements.filter((sql) =>
			sql.includes('INSERT INTO schema_migrations'),
		)
		expect(inserts).toHaveLength(2)
	})

	it('backup document is versioned restore format', () => {
		const backup = createEmptyBackup('0.1.0', '2026-08-26T12:00:00.000Z')
		expect(backup.format).toBe(BACKUP_FORMAT)
		expect(backup.version).toBe(BACKUP_VERSION)
		expect(backupFileName('2026-08-26T12:00:00.000Z')).toBe(
			'auto-journal-backup-2026-08-26-1200.json',
		)
	})
})
