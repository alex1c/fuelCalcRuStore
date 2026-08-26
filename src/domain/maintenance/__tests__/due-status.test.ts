import {
	completeMaintenance,
	getMaintenanceDueStatus,
} from '@/domain/maintenance'

describe('maintenance due status + completion', () => {
	const base = {
		id: 'm1',
		vehicleId: 'v1',
		title: 'Масло',
		active: true,
		remind: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	}

	it('reports remaining km and ok/soon/overdue', () => {
		const item = {
			...base,
			lastServiceOdometerKm: 10_000,
			intervalKm: 10_000,
		}

		const ok = getMaintenanceDueStatus(item, {
			dateIso: '2026-08-01T00:00:00.000Z',
			odometerKm: 10_600,
		})
		expect(ok.remainingKm).toBe(9400)
		expect(ok.urgency).toBe('ok')

		const soon = getMaintenanceDueStatus(item, {
			dateIso: '2026-08-01T00:00:00.000Z',
			odometerKm: 19_500,
		})
		expect(soon.remainingKm).toBe(500)
		expect(soon.urgency).toBe('soon')

		const overdue = getMaintenanceDueStatus(item, {
			dateIso: '2026-08-01T00:00:00.000Z',
			odometerKm: 21_000,
		})
		expect(overdue.remainingKm).toBe(-1000)
		expect(overdue.urgency).toBe('overdue')
		expect(overdue.isOverdue).toBe(true)
	})

	it('reports remaining days with soon/overdue thresholds', () => {
		const item = {
			...base,
			lastServiceDate: '2026-01-01T00:00:00.000Z',
			intervalDays: 365,
		}

		const status = getMaintenanceDueStatus(item, {
			dateIso: '2026-12-14T00:00:00.000Z',
			odometerKm: 12_000,
		})
		expect(status.remainingDays).toBe(18)
		expect(status.urgencyDays).toBe('soon')
	})

	it('completeMaintenance resets last service markers', () => {
		const item = {
			...base,
			lastServiceDate: '2025-01-01T00:00:00.000Z',
			lastServiceOdometerKm: 10_000,
			intervalKm: 10_000,
		}
		const completed = completeMaintenance(item, {
			dateIso: '2026-08-26T12:00:00.000Z',
			odometerKm: 20_500,
			nowIso: '2026-08-26T12:00:00.000Z',
		})
		expect(completed.lastServiceOdometerKm).toBe(20_500)
		expect(completed.lastServiceDate).toBe('2026-08-26T12:00:00.000Z')
	})
})
