import {
	estimateTripFuel,
	estimateTripOwnershipCost,
} from '@/domain/trip/calculate'

describe('trip calculator', () => {
	it('estimates fuel liters and fuel cost', () => {
		const result = estimateTripFuel({
			distanceKm: 200,
			fuelConsumption: 8,
			fuelPrice: 50,
		})

		expect(result.ok).toBe(true)
		if (!result.ok) {
			return
		}

		expect(result.value.estimatedLiters).toBeCloseTo(16, 5)
		expect(result.value.estimatedFuelCostMajor).toBeCloseTo(800, 5)
	})

	it('estimates ownership cost separately from fuel cost', () => {
		const fuel = estimateTripFuel({
			distanceKm: 100,
			fuelConsumption: 8,
			fuelPrice: 50,
		})
		const ownership = estimateTripOwnershipCost({
			distanceKm: 100,
			costPerKmMajor: 12,
		})

		expect(fuel.ok && ownership.ok).toBe(true)
		if (!fuel.ok || !ownership.ok) {
			return
		}

		expect(fuel.value.estimatedFuelCostMajor).toBeCloseTo(400, 5)
		expect(ownership.value.estimatedOwnershipCostMajor).toBeCloseTo(1200, 5)
		expect(fuel.value.estimatedFuelCostMajor).not.toBe(
			ownership.value.estimatedOwnershipCostMajor,
		)
	})

	it('rejects non-positive inputs', () => {
		expect(
			estimateTripFuel({ distanceKm: 0, fuelConsumption: 8, fuelPrice: 50 }).ok,
		).toBe(false)
		expect(
			estimateTripOwnershipCost({ distanceKm: 10, costPerKmMajor: -1 }).ok,
		).toBe(false)
	})
})
