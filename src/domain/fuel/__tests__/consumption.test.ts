import { calculateConsumption } from '@/domain/fuel/consumption'
import { validateFuelOdometer } from '@/domain/fuel/validate'
import { fuelEntry } from '@/domain/__fixtures__/builders'

const VEHICLE_A = 'vehicle-a'
const VEHICLE_B = 'vehicle-b'

describe('fuel consumption — full-tank method', () => {
	it('first full tank alone → insufficient data', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
			}),
		]

		const result = calculateConsumption(entries, VEHICLE_A)
		expect(result).toEqual({
			status: 'insufficient_data',
			reason: 'only_baseline_full_tank',
		})
	})

	it('two full tanks → 8.0 L/100km', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_500,
				litersMl: 40_000,
				fullTank: true,
			}),
		]

		const result = calculateConsumption(entries, VEHICLE_A)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}

		expect(result.intervals).toHaveLength(1)
		expect(result.intervals[0].distanceKm).toBe(500)
		expect(result.intervals[0].litersPer100Km).toBeCloseTo(8, 5)
		expect(result.averageLitersPer100Km).toBeCloseTo(8, 5)
		expect(result.intervals[0].explanation.fuelLiters).toBe(40)
	})

	it('one partial between fulls → 7.5 L/100km over full interval', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 50_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'p1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_300,
				litersMl: 20_000,
				fullTank: false,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_600,
				litersMl: 25_000,
				fullTank: true,
			}),
		]

		const result = calculateConsumption(entries, VEHICLE_A)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}

		expect(result.intervals).toHaveLength(1)
		expect(result.intervals[0].distanceKm).toBe(600)
		expect(result.intervals[0].litersPer100Km).toBeCloseTo(7.5, 5)
		// Partial must not create its own consumption row.
		expect(result.intervals.every((i) => i.endEntryId === 'f2')).toBe(true)
	})

	it('several partials between fulls are summed into one interval', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 0,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'p1',
				vehicleId: VEHICLE_A,
				odometerKm: 100,
				litersMl: 10_000,
				fullTank: false,
			}),
			fuelEntry({
				id: 'p2',
				vehicleId: VEHICLE_A,
				odometerKm: 200,
				litersMl: 15_000,
				fullTank: false,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 400,
				litersMl: 15_000,
				fullTank: true,
			}),
		]

		const result = calculateConsumption(entries, VEHICLE_A)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}

		expect(result.intervals).toHaveLength(1)
		expect(result.intervals[0].fuelMl).toBe(40_000)
		expect(result.intervals[0].litersPer100Km).toBeCloseTo(10, 5)
	})

	it('history without full tank → insufficient data', () => {
		const entries = [
			fuelEntry({
				id: 'p1',
				vehicleId: VEHICLE_A,
				odometerKm: 1000,
				litersMl: 20_000,
				fullTank: false,
			}),
			fuelEntry({
				id: 'p2',
				vehicleId: VEHICLE_A,
				odometerKm: 1200,
				litersMl: 25_000,
				fullTank: false,
			}),
		]

		expect(calculateConsumption(entries, VEHICLE_A)).toEqual({
			status: 'insufficient_data',
			reason: 'no_full_tank',
		})
	})

	it('editing an old entry recalculates later consumption', () => {
		const base = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_500,
				litersMl: 40_000,
				fullTank: true,
			}),
		]

		const before = calculateConsumption(base, VEHICLE_A)
		expect(before.status === 'ok' && before.averageLitersPer100Km).toBeCloseTo(8, 5)

		const edited = base.map((entry) =>
			entry.id === 'f2' ? { ...entry, litersMl: 50_000 } : entry,
		)
		const after = calculateConsumption(edited, VEHICLE_A)
		expect(after.status === 'ok' && after.averageLitersPer100Km).toBeCloseTo(10, 5)
	})

	it('deleting an old middle full tank merges surrounding math correctly', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_500,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'f3',
				vehicleId: VEHICLE_A,
				odometerKm: 11_000,
				litersMl: 40_000,
				fullTank: true,
			}),
		]

		const withMiddle = calculateConsumption(entries, VEHICLE_A)
		expect(withMiddle.status === 'ok' && withMiddle.intervals).toHaveLength(2)

		const withoutMiddle = calculateConsumption(
			entries.filter((entry) => entry.id !== 'f2'),
			VEHICLE_A,
		)
		expect(withoutMiddle.status).toBe('ok')
		if (withoutMiddle.status !== 'ok') {
			return
		}

		expect(withoutMiddle.intervals).toHaveLength(1)
		expect(withoutMiddle.intervals[0].distanceKm).toBe(1000)
		expect(withoutMiddle.intervals[0].litersPer100Km).toBeCloseTo(4, 5)
	})

	it('backdated insert between fulls is included by odometer order, not createdAt', () => {
		const entries = [
			fuelEntry({
				id: 'f1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
				recordedAt: '2026-01-01T10:00:00.000Z',
				createdAt: '2026-01-01T10:00:00.000Z',
			}),
			fuelEntry({
				id: 'f2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_600,
				litersMl: 25_000,
				fullTank: true,
				recordedAt: '2026-01-10T10:00:00.000Z',
				createdAt: '2026-01-10T10:00:00.000Z',
			}),
			// Forgotten partial, added later but with earlier odometer/time.
			fuelEntry({
				id: 'p-late',
				vehicleId: VEHICLE_A,
				odometerKm: 10_300,
				litersMl: 20_000,
				fullTank: false,
				recordedAt: '2026-01-05T10:00:00.000Z',
				createdAt: '2026-02-01T10:00:00.000Z',
			}),
		]

		const result = calculateConsumption(entries, VEHICLE_A)
		expect(result.status).toBe('ok')
		if (result.status !== 'ok') {
			return
		}

		expect(result.intervals[0].litersPer100Km).toBeCloseTo(7.5, 5)
	})

	it('isolates vehicles — B never affects A', () => {
		const entries = [
			fuelEntry({
				id: 'a1',
				vehicleId: VEHICLE_A,
				odometerKm: 10_000,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'a2',
				vehicleId: VEHICLE_A,
				odometerKm: 10_500,
				litersMl: 40_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'b1',
				vehicleId: VEHICLE_B,
				odometerKm: 10_000,
				litersMl: 100_000,
				fullTank: true,
			}),
			fuelEntry({
				id: 'b2',
				vehicleId: VEHICLE_B,
				odometerKm: 10_100,
				litersMl: 100_000,
				fullTank: true,
			}),
		]

		const a = calculateConsumption(entries, VEHICLE_A)
		const b = calculateConsumption(entries, VEHICLE_B)
		expect(a.status === 'ok' && a.averageLitersPer100Km).toBeCloseTo(8, 5)
		expect(b.status === 'ok' && b.averageLitersPer100Km).toBeCloseTo(100, 5)
	})
})

describe('fuel odometer validation', () => {
	const existing = [
		fuelEntry({
			id: 'f1',
			vehicleId: VEHICLE_A,
			odometerKm: 50_000,
			litersMl: 40_000,
			fullTank: true,
			recordedAt: '2026-01-01T12:00:00.000Z',
		}),
		fuelEntry({
			id: 'f2',
			vehicleId: VEHICLE_A,
			odometerKm: 50_500,
			litersMl: 40_000,
			fullTank: true,
			recordedAt: '2026-01-10T12:00:00.000Z',
		}),
	]

	it('rejects decreasing odometer after previous neighbor', () => {
		const result = validateFuelOdometer(existing, {
			id: 'new',
			vehicleId: VEHICLE_A,
			odometerKm: 49_000,
			recordedAt: '2026-01-11T12:00:00.000Z',
		})
		expect(result.ok).toBe(false)
		if (result.ok) {
			return
		}

		expect(result.errors[0].code).toBe('ODOMETER_DECREASING')
	})

	it('rejects identical odometer as neighbor', () => {
		const result = validateFuelOdometer(existing, {
			id: 'new',
			vehicleId: VEHICLE_A,
			odometerKm: 50_500,
			recordedAt: '2026-01-11T12:00:00.000Z',
		})
		expect(result.ok).toBe(false)
		if (result.ok) {
			return
		}

		expect(result.errors[0].code).toBe('ODOMETER_NOT_INCREASING')
	})

	it('allows inserting a forgotten fill between existing readings', () => {
		const result = validateFuelOdometer(existing, {
			id: 'mid',
			vehicleId: VEHICLE_A,
			odometerKm: 50_200,
			recordedAt: '2026-01-05T12:00:00.000Z',
		})
		expect(result).toEqual({ ok: true, value: true })
	})

	it('rejects zero liters via resolve path is separate; odometer zero is allowed for first entry', () => {
		const result = validateFuelOdometer([], {
			id: 'first',
			vehicleId: VEHICLE_A,
			odometerKm: 0,
			recordedAt: '2026-01-01T12:00:00.000Z',
		})
		expect(result.ok).toBe(true)
	})
})
