/**
 * Phase 3 scenario smoke at the domain layer (Toyota / fuel / expense / maintenance).
 * Complements UI emulator smoke without depending on uiautomator.
 */
import {
	aggregateCosts,
	calculateCostPerKm,
	monthPeriod,
	yearPeriod,
} from '@/domain/expenses'
import type { Expense } from '@/domain/expenses/types'
import { calculateConsumption } from '@/domain/fuel'
import type { FuelEntry } from '@/domain/fuel/types'
import {
	completeMaintenance,
	getMaintenanceDueStatus,
} from '@/domain/maintenance'
import type { MaintenanceItem } from '@/domain/maintenance/types'
import type { Vehicle } from '@/domain/vehicle/types'
import { parseOdometerKm } from '@/units'

function entry(
	partial: Omit<FuelEntry, 'createdAt' | 'updatedAt'> & {
		createdAt?: string
		updatedAt?: string
	},
): FuelEntry {
	const now = partial.recordedAt
	return {
		createdAt: partial.createdAt ?? now,
		updatedAt: partial.updatedAt ?? now,
		...partial,
	}
}

describe('Phase 3 scenario smoke (domain)', () => {
	const vehicleId = 'veh-toyota'
	const vehicle: Vehicle = {
		id: vehicleId,
		displayName: 'Toyota',
		fuelType: 'petrol95',
		currentOdometerKm: 10600,
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-26T00:00:00.000Z',
	}

	it('rejects tolerant odometer suffixes', () => {
		expect(parseOdometerKm('10000').ok).toBe(true)
		expect(parseOdometerKm('10000abc').ok).toBe(false)
		expect(parseOdometerKm('10000.5').ok).toBe(false)
		expect(parseOdometerKm('10000,5').ok).toBe(false)
	})

	it('computes 7.5 L/100 km for baseline + partial + full', () => {
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			entry({
				id: 'f2',
				vehicleId,
				recordedAt: '2026-08-10T10:00:00.000Z',
				odometerKm: 10300,
				litersMl: 20_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 100_000,
				fullTank: false,
			}),
			entry({
				id: 'f3',
				vehicleId,
				recordedAt: '2026-08-20T10:00:00.000Z',
				odometerKm: 10600,
				litersMl: 25_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 125_000,
				fullTank: true,
			}),
		]

		const result = calculateConsumption(fuel, vehicleId)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}
		// (20 + 25) L / 600 km * 100 = 7.5
		expect(result.averageLitersPer100Km).toBeCloseTo(7.5, 5)
	})

	it('does not double-count fuel when aggregating expenses', () => {
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			entry({
				id: 'f2',
				vehicleId,
				recordedAt: '2026-08-10T10:00:00.000Z',
				odometerKm: 10300,
				litersMl: 20_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 100_000,
				fullTank: false,
			}),
			entry({
				id: 'f3',
				vehicleId,
				recordedAt: '2026-08-20T10:00:00.000Z',
				odometerKm: 10600,
				litersMl: 25_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 125_000,
				fullTank: true,
			}),
		]
		const expenses: Expense[] = [
			{
				id: 'e1',
				vehicleId,
				category: 'washing',
				amountKopecks: 100_000,
				recordedAt: '2026-08-21T12:00:00.000Z',
				createdAt: '2026-08-21T12:00:00.000Z',
				updatedAt: '2026-08-21T12:00:00.000Z',
			},
		]

		const month = monthPeriod(2026, 8)
		const totals = aggregateCosts(fuel, expenses, vehicleId, month)
		// fuel 200+100+125 = 425_000 + washing 100_000
		expect(totals.totalKopecks).toBe(525_000)
		expect(totals.byCategory.fuel).toBe(425_000)
		expect(totals.byCategory.washing).toBe(100_000)

		const year = yearPeriod(2026)
		expect(aggregateCosts(fuel, expenses, vehicleId, year).totalKopecks).toBe(
			525_000,
		)
	})

	it('recalculates consumption after editing partial liters', () => {
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			entry({
				id: 'f2',
				vehicleId,
				recordedAt: '2026-08-10T10:00:00.000Z',
				odometerKm: 10300,
				litersMl: 25_000, // edited 20 → 25
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 125_000,
				fullTank: false,
			}),
			entry({
				id: 'f3',
				vehicleId,
				recordedAt: '2026-08-20T10:00:00.000Z',
				odometerKm: 10600,
				litersMl: 25_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 125_000,
				fullTank: true,
			}),
		]
		const result = calculateConsumption(fuel, vehicleId)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}
		// 50 L / 600 km * 100 ≈ 8.333...
		expect(result.averageLitersPer100Km).toBeCloseTo(50 / 6, 5)
	})

	it('recalculates after deleting the partial entry', () => {
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			entry({
				id: 'f3',
				vehicleId,
				recordedAt: '2026-08-20T10:00:00.000Z',
				odometerKm: 10600,
				litersMl: 25_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 125_000,
				fullTank: true,
			}),
		]
		const result = calculateConsumption(fuel, vehicleId)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}
		// only full→full: 25 L / 600 km * 100
		expect(result.averageLitersPer100Km).toBeCloseTo(25 / 6, 5)
	})

	it('reports maintenance remaining km and completion reset', () => {
		const item: MaintenanceItem = {
			id: 'm1',
			vehicleId,
			title: 'Масло',
			lastServiceDate: '2026-08-01',
			lastServiceOdometerKm: 10000,
			intervalKm: 10000,
			active: true,
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-01T00:00:00.000Z',
		}
		const status = getMaintenanceDueStatus(item, {
			odometerKm: vehicle.currentOdometerKm,
			dateIso: '2026-08-26T12:00:00.000Z',
		})
		expect(status.remainingKm).toBe(9400)
		expect(status.urgency).toBe('ok')

		const completed = completeMaintenance(item, {
			dateIso: '2026-08-26',
			odometerKm: 10600,
			nowIso: '2026-08-26T12:00:00.000Z',
		})
		expect(completed.lastServiceOdometerKm).toBe(10600)
		const after = getMaintenanceDueStatus(completed, {
			odometerKm: 10600,
			dateIso: '2026-08-26T12:00:00.000Z',
		})
		expect(after.remainingKm).toBe(10000)
	})

	it('returns insufficient cost/km without enough distance', () => {
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
		]
		const cost = calculateCostPerKm(fuel, [], vehicleId)
		expect(cost.status).toBe('insufficient_data')
	})

	it('isolates vehicles in aggregates', () => {
		const otherId = 'veh-other'
		const fuel: FuelEntry[] = [
			entry({
				id: 'f1',
				vehicleId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 10000,
				litersMl: 40_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			entry({
				id: 'f-other',
				vehicleId: otherId,
				recordedAt: '2026-08-01T10:00:00.000Z',
				odometerKm: 5000,
				litersMl: 10_000,
				pricePerLiterKopecks: 5000,
				totalCostKopecks: 999_999,
				fullTank: true,
			}),
		]
		const month = monthPeriod(2026, 8)
		const totals = aggregateCosts(fuel, [], vehicleId, month)
		expect(totals.totalKopecks).toBe(200_000)
	})
})
