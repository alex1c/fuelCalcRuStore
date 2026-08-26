import { mapFuelEntryRow, mapVehicleRow } from '@/persistence/mappers'

describe('persistence mappers', () => {
	it('maps vehicle row to domain model', () => {
		const vehicle = mapVehicleRow({
			id: 'v1',
			display_name: 'My car',
			make: 'Toyota',
			model: null,
			fuel_type: 'petrol95',
			current_odometer_km: 12000,
			created_at: '2026-01-01T00:00:00.000Z',
			updated_at: '2026-01-02T00:00:00.000Z',
		})

		expect(vehicle).toEqual({
			id: 'v1',
			displayName: 'My car',
			make: 'Toyota',
			fuelType: 'petrol95',
			currentOdometerKm: 12000,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z',
		})
	})

	it('maps fuel entry row including fullTank flag', () => {
		const entry = mapFuelEntryRow({
			id: 'f1',
			vehicle_id: 'v1',
			recorded_at: '2026-01-01T00:00:00.000Z',
			odometer_km: 1000,
			liters_ml: 40500,
			total_cost_kopecks: 200000,
			price_per_liter_kopecks: 4938,
			full_tank: 1,
			note: null,
			created_at: '2026-01-01T00:00:00.000Z',
			updated_at: '2026-01-01T00:00:00.000Z',
		})

		expect(entry.fullTank).toBe(true)
		expect(entry.vehicleId).toBe('v1')
		expect(entry.litersMl).toBe(40500)
		expect(entry.note).toBeUndefined()
	})
})
