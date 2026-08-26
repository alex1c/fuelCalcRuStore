import {
	migrateBackupToCurrentVersion,
} from '@/backup/migrate'
import {
	parseAndValidateBackup,
} from '@/backup/validate'
import { serializeBackup } from '@/backup/serialize'
import {
	restoreBackupReplaceAll,
	type RestoreDatabase,
} from '@/backup/restore'
import {
	BACKUP_FORMAT,
	BACKUP_VERSION,
	createEmptyBackup,
	type AutoJournalBackupV1,
} from '@/persistence/backup-types'

function sampleBackup(): AutoJournalBackupV1 {
	const backup = createEmptyBackup('0.1.0', '2026-08-26T12:00:00.000Z')
	backup.vehicles = [
		{
			id: 'v-a',
			displayName: 'Toyota',
			fuelType: 'petrol95',
			currentOdometerKm: 10600,
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-26T00:00:00.000Z',
		},
		{
			id: 'v-b',
			displayName: 'Lada',
			fuelType: 'petrol92',
			currentOdometerKm: 5000,
			createdAt: '2026-08-02T00:00:00.000Z',
			updatedAt: '2026-08-02T00:00:00.000Z',
		},
	]
	backup.fuelEntries = [
		{
			id: 'f1',
			vehicleId: 'v-a',
			recordedAt: '2026-08-10T10:00:00.000Z',
			odometerKm: 10000,
			litersMl: 40_000,
			pricePerLiterKopecks: 5000,
			totalCostKopecks: 200_000,
			fullTank: true,
			createdAt: '2026-08-10T10:00:00.000Z',
			updatedAt: '2026-08-10T10:00:00.000Z',
		},
	]
	backup.expenses = [
		{
			id: 'e1',
			vehicleId: 'v-a',
			category: 'washing',
			amountKopecks: 100_000,
			recordedAt: '2026-08-11T12:00:00.000Z',
			createdAt: '2026-08-11T12:00:00.000Z',
			updatedAt: '2026-08-11T12:00:00.000Z',
		},
	]
	backup.maintenance = [
		{
			id: 'm1',
			vehicleId: 'v-a',
			title: 'Масло',
			lastServiceDate: '2026-08-01T00:00:00.000Z',
			lastServiceOdometerKm: 10000,
			intervalKm: 10000,
			intervalDays: 365,
			active: true,
			remind: true,
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-01T00:00:00.000Z',
		},
	]
	backup.settings = {
		currencyCode: 'RUB',
		activeVehicleId: 'v-a',
	}
	return backup
}

describe('backup validation', () => {
	it('accepts a valid v1 document', () => {
		const result = parseAndValidateBackup(serializeBackup(sampleBackup()))
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.backup.format).toBe(BACKUP_FORMAT)
			expect(result.backup.version).toBe(BACKUP_VERSION)
			expect(result.backup.vehicles).toHaveLength(2)
			expect(result.backup.settings.activeVehicleId).toBe('v-a')
		}
	})

	it('rejects invalid JSON / wrong format / unsupported version', () => {
		expect(parseAndValidateBackup('{').ok).toBe(false)
		expect(
			parseAndValidateBackup(JSON.stringify({ format: 'other', version: 1 })),
		).toEqual(expect.objectContaining({ ok: false, code: 'WRONG_FORMAT' }))
		expect(
			parseAndValidateBackup(
				JSON.stringify({ ...sampleBackup(), version: 99 }),
			),
		).toEqual(
			expect.objectContaining({ ok: false, code: 'UNSUPPORTED_VERSION' }),
		)
	})

	it('rejects orphan vehicleId and duplicate ids', () => {
		const orphan = sampleBackup()
		orphan.fuelEntries[0].vehicleId = 'missing'
		expect(parseAndValidateBackup(serializeBackup(orphan)).ok).toBe(false)

		const dup = sampleBackup()
		dup.vehicles.push({ ...dup.vehicles[0] })
		expect(parseAndValidateBackup(serializeBackup(dup)).ok).toBe(false)
	})

	it('migrateBackupToCurrentVersion fills missing remind', () => {
		const raw = sampleBackup() as unknown as Record<string, unknown>
		const maintenance = (raw.maintenance as Record<string, unknown>[])[0]
		delete maintenance.remind
		const migrated = migrateBackupToCurrentVersion(raw)
		expect(migrated.ok).toBe(true)
		if (migrated.ok) {
			expect(migrated.backup.maintenance[0].remind).toBe(false)
		}
	})

	it('serializeBackup does not include derived metrics keys', () => {
		const json = serializeBackup(sampleBackup())
		expect(json).not.toContain('averageLitersPer100Km')
		expect(json).not.toContain('costPerKm')
		expect(json).toContain('"format": "auto-journal-backup"')
	})
})

describe('backup restore replace-all', () => {
	function createMemoryRestoreDb() {
		const state = {
			vehicles: 0,
			fuel: 0,
			expenses: 0,
			maintenance: 0,
			settings: 0,
			failOnVehicleInsert: false,
		}

		const db: RestoreDatabase & { state: typeof state } = {
			state,
			async withTransactionAsync(fn) {
				const snapshot = { ...state }
				try {
					await fn()
				} catch (error) {
					Object.assign(state, snapshot)
					throw error
				}
			},
			async execAsync(sql: string) {
				if (sql.includes('DELETE FROM vehicles')) {
					state.vehicles = 0
				}
				if (sql.includes('DELETE FROM fuel_entries')) {
					state.fuel = 0
				}
				if (sql.includes('DELETE FROM expenses')) {
					state.expenses = 0
				}
				if (sql.includes('DELETE FROM maintenance_items')) {
					state.maintenance = 0
				}
				if (sql.includes('DELETE FROM settings')) {
					state.settings = 0
				}
			},
			async runAsync(sql: string) {
				if (sql.includes('INSERT INTO vehicles')) {
					if (state.failOnVehicleInsert) {
						throw new Error('boom')
					}
					state.vehicles += 1
				}
				if (sql.includes('INSERT INTO fuel_entries')) {
					state.fuel += 1
				}
				if (sql.includes('INSERT INTO expenses')) {
					state.expenses += 1
				}
				if (sql.includes('INSERT INTO maintenance_items')) {
					state.maintenance += 1
				}
				if (sql.includes('INSERT INTO settings')) {
					state.settings += 1
				}
			},
		}

		return db
	}

	it('restores multiple vehicles and settings', async () => {
		const db = createMemoryRestoreDb()
		db.state.vehicles = 9
		const result = await restoreBackupReplaceAll(sampleBackup(), db)
		expect(result.ok).toBe(true)
		expect(db.state.vehicles).toBe(2)
		expect(db.state.fuel).toBe(1)
		expect(db.state.expenses).toBe(1)
		expect(db.state.maintenance).toBe(1)
		expect(db.state.settings).toBe(1)
	})

	it('rolls back and preserves prior counts on error', async () => {
		const db = createMemoryRestoreDb()
		db.state.vehicles = 3
		db.state.fuel = 5
		db.state.failOnVehicleInsert = true
		const result = await restoreBackupReplaceAll(sampleBackup(), db)
		expect(result.ok).toBe(false)
		expect(db.state.vehicles).toBe(3)
		expect(db.state.fuel).toBe(5)
	})
})
