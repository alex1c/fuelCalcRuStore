import {
	aggregateCosts,
	calculateCostPerKm,
	monthPeriod,
	normalizeAndValidateExpense,
	yearPeriod,
} from '@/domain/expenses'
import { expense, fuelEntry } from '@/domain/__fixtures__/builders'

const VEHICLE_A = 'vehicle-a'
const VEHICLE_B = 'vehicle-b'

describe('expense aggregation', () => {
	it('includes fuel entries + non-fuel expenses without double counting', () => {
		const fuels = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 40_000,
				totalCostKopecks: 200_000,
				fullTank: true,
				recordedAt: '2026-03-01T10:00:00.000Z',
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 1500,
				litersMl: 40_000,
				totalCostKopecks: 200_000,
				fullTank: true,
				recordedAt: '2026-03-10T10:00:00.000Z',
			}),
		]
		const expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 100_000,
				category: 'washing',
				recordedAt: '2026-03-05T10:00:00.000Z',
			}),
		]

		const breakdown = aggregateCosts(fuels, expenses, VEHICLE_A)
		expect(breakdown.fuelKopecks).toBe(400_000)
		expect(breakdown.nonFuelKopecks).toBe(100_000)
		expect(breakdown.totalKopecks).toBe(500_000)
		expect(breakdown.byCategory.fuel).toBe(400_000)
		expect(breakdown.byCategory.washing).toBe(100_000)
	})

	it('rejects expense category fuel', () => {
		const result = normalizeAndValidateExpense({
			id: 'bad',
			vehicleId: VEHICLE_A,
			recordedAt: '2026-03-01T00:00:00.000Z',
			amount: 100,
			category: 'fuel',
			createdAt: '2026-03-01T00:00:00.000Z',
			updatedAt: '2026-03-01T00:00:00.000Z',
		})
		expect(result.ok).toBe(false)
		if (result.ok) {
			return
		}

		expect(result.errors[0].code).toBe('FUEL_EXPENSE_NOT_ALLOWED')
	})

	it('aggregates by month and year', () => {
		const fuels = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 10_000,
				totalCostKopecks: 50_000,
				fullTank: true,
				recordedAt: '2026-01-15T10:00:00.000Z',
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 1200,
				litersMl: 10_000,
				totalCostKopecks: 60_000,
				fullTank: true,
				recordedAt: '2026-02-15T10:00:00.000Z',
			}),
		]
		const expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 10_000,
				category: 'tax',
				recordedAt: '2026-01-20T10:00:00.000Z',
			}),
		]

		const jan = aggregateCosts(fuels, expenses, VEHICLE_A, monthPeriod(2026, 1))
		expect(jan.totalKopecks).toBe(60_000)

		const year = aggregateCosts(fuels, expenses, VEHICLE_A, yearPeriod(2026))
		expect(year.totalKopecks).toBe(120_000)
	})

	it('aggregates by category', () => {
		const expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 30_000,
				category: 'parts',
			}),
			expense({
				id: 'e2',
				vehicleId: VEHICLE_A,
				amountKopecks: 70_000,
				category: 'insurance',
			}),
		]
		const breakdown = aggregateCosts([], expenses, VEHICLE_A)
		expect(breakdown.byCategory.parts).toBe(30_000)
		expect(breakdown.byCategory.insurance).toBe(70_000)
		expect(breakdown.byCategory.fuel).toBe(0)
	})

	it('ignores other vehicles', () => {
		const fuels = [
			fuelEntry({
				id: 'fb',
				vehicleId: VEHICLE_B,
				odometerKm: 100,
				litersMl: 10_000,
				totalCostKopecks: 999_999,
				fullTank: true,
			}),
		]
		const expenses = [
			expense({
				id: 'eb',
				vehicleId: VEHICLE_B,
				amountKopecks: 888_888,
				category: 'repair',
			}),
		]
		const breakdown = aggregateCosts(fuels, expenses, VEHICLE_A)
		expect(breakdown.totalKopecks).toBe(0)
	})
})

describe('cost per km', () => {
	it('returns valid ₽/км for spanned history', () => {
		const fuels = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 40_000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 1500,
				litersMl: 40_000,
				totalCostKopecks: 300_000,
				fullTank: true,
			}),
		]
		const expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 100_000,
				category: 'repair',
			}),
		]

		const result = calculateCostPerKm(fuels, expenses, VEHICLE_A)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}

		// (2000+3000+1000) RUB / 500 km = 12 RUB/km → 1200 kopecks/km
		expect(result.costPerKmMajor).toBeCloseTo(12, 5)
		expect(result.explanation?.distanceKm).toBe(500)
	})

	it('insufficient data when no odometer span', () => {
		const fuels = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 40_000,
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
		]
		const result = calculateCostPerKm(fuels, [], VEHICLE_A)
		expect(result).toMatchObject({
			status: 'insufficient_data',
			reason: 'no_odometer_span',
		})
	})

	it('insufficient data on zero distance', () => {
		const fuels = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 10_000,
				totalCostKopecks: 10_000,
				fullTank: true,
				recordedAt: '2026-01-01T00:00:00.000Z',
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 10_000,
				totalCostKopecks: 10_000,
				fullTank: true,
				recordedAt: '2026-01-02T00:00:00.000Z',
			}),
		]
		const result = calculateCostPerKm(fuels, [], VEHICLE_A)
		expect(result).toMatchObject({
			status: 'insufficient_data',
			reason: 'zero_distance',
		})
	})
})
