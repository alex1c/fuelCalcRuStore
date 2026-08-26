import {
	aggregateCosts,
	calculateCostPerKm,
	normalizeAndValidateExpense,
} from '@/domain/expenses'
import { expense, fuelEntry } from '@/domain/__fixtures__/builders'

const VEHICLE_A = 'vehicle-a'
const VEHICLE_B = 'vehicle-b'

describe('ownership cost isolation and edits', () => {
	it('edit/delete expense updates totals without double counting fuel', () => {
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
				totalCostKopecks: 200_000,
				fullTank: true,
			}),
		]

		let expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 100_000,
				category: 'washing',
			}),
		]

		expect(aggregateCosts(fuels, expenses, VEHICLE_A).totalKopecks).toBe(500_000)

		expenses = [
			expense({
				id: 'e1',
				vehicleId: VEHICLE_A,
				amountKopecks: 150_000,
				category: 'washing',
			}),
		]
		expect(aggregateCosts(fuels, expenses, VEHICLE_A).totalKopecks).toBe(550_000)

		expenses = []
		expect(aggregateCosts(fuels, expenses, VEHICLE_A).totalKopecks).toBe(400_000)
	})

	it('cost/km isolates vehicles and reports insufficient distance', () => {
		const fuels = [
			fuelEntry({
				id: 'a1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 10_000,
				totalCostKopecks: 100_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'a2',
				vehicleId: VEHICLE_A,
				odometerKm: 1500,
				litersMl: 10_000,
				totalCostKopecks: 100_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'b1',
				vehicleId: VEHICLE_B,
				odometerKm: 100,
				litersMl: 10_000,
				totalCostKopecks: 999_999,
				fullTank: true,
			}),
		]

		const a = calculateCostPerKm(fuels, [], VEHICLE_A)
		expect(a.status).toBe('ok')
		if (a.status === 'ok') {
			expect(a.costPerKmMajor).toBeCloseTo(4, 5)
		}

		const b = calculateCostPerKm(fuels, [], VEHICLE_B)
		expect(b.status).toBe('insufficient_data')
	})

	it('rejects fuel category expense draft', () => {
		const result = normalizeAndValidateExpense({
			id: 'x',
			vehicleId: VEHICLE_A,
			recordedAt: '2026-01-01T00:00:00.000Z',
			amount: 100,
			category: 'fuel',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
		})
		expect(result.ok).toBe(false)
	})
})
