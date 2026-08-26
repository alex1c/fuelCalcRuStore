import { mlToLiters } from '@/domain/shared/volume'
import type { FuelEntry } from './types'
import { filterFuelEntriesByVehicle, sortFuelEntries } from './validate'

/** One valid full-tank → full-tank consumption interval. */
export interface ConsumptionInterval {
	startEntryId: string
	endEntryId: string
	startOdometerKm: number
	endOdometerKm: number
	distanceKm: number
	/** Fuel added after start through end inclusive, in milliliters. */
	fuelMl: number
	litersPer100Km: number
	/** Enough data for UI to explain: fuelL / distanceKm × 100. */
	explanation: {
		distanceKm: number
		fuelLiters: number
		formula: string
	}
}

export type ConsumptionStatus =
	| { status: 'ok'; intervals: ConsumptionInterval[]; averageLitersPer100Km: number }
	| { status: 'insufficient_data'; reason: InsufficientConsumptionReason }

export type InsufficientConsumptionReason =
	| 'no_entries'
	| 'no_full_tank'
	| 'only_baseline_full_tank'
	| 'no_valid_interval'

export interface AverageConsumptionForPeriod {
	status: 'ok' | 'insufficient_data'
	litersPer100Km?: number
	distanceKm?: number
	fuelLiters?: number
	intervalsUsed: number
	reason?: InsufficientConsumptionReason
}

/**
 * Full-tank method:
 * - First full tank is baseline only (no rate).
 * - Partial fills never create their own rate.
 * - Interval fuel = sum(liters) after start full up to and including end full.
 */
export function calculateConsumption(
	entries: FuelEntry[],
	vehicleId: string,
): ConsumptionStatus {
	const sorted = sortFuelEntries(filterFuelEntriesByVehicle(entries, vehicleId))

	if (sorted.length === 0) {
		return { status: 'insufficient_data', reason: 'no_entries' }
	}

	const fullTankIndexes: number[] = []

	for (let i = 0; i < sorted.length; i += 1) {
		if (sorted[i].fullTank) {
			fullTankIndexes.push(i)
		}
	}

	if (fullTankIndexes.length === 0) {
		return { status: 'insufficient_data', reason: 'no_full_tank' }
	}

	if (fullTankIndexes.length === 1) {
		return { status: 'insufficient_data', reason: 'only_baseline_full_tank' }
	}

	const intervals: ConsumptionInterval[] = []

	for (let f = 0; f < fullTankIndexes.length - 1; f += 1) {
		const startIndex = fullTankIndexes[f]
		const endIndex = fullTankIndexes[f + 1]
		const start = sorted[startIndex]
		const end = sorted[endIndex]
		const distanceKm = end.odometerKm - start.odometerKm

		if (distanceKm <= 0) {
			continue
		}

		let fuelMl = 0

		for (let i = startIndex + 1; i <= endIndex; i += 1) {
			fuelMl += sorted[i].litersMl
		}

		if (fuelMl <= 0) {
			continue
		}

		const fuelLiters = mlToLiters(fuelMl)
		const litersPer100Km = (fuelLiters / distanceKm) * 100

		intervals.push({
			startEntryId: start.id,
			endEntryId: end.id,
			startOdometerKm: start.odometerKm,
			endOdometerKm: end.odometerKm,
			distanceKm,
			fuelMl,
			litersPer100Km,
			explanation: {
				distanceKm,
				fuelLiters,
				formula: `${formatNumber(fuelLiters)} / ${distanceKm} × 100 = ${formatNumber(litersPer100Km)}`,
			},
		})
	}

	if (intervals.length === 0) {
		return { status: 'insufficient_data', reason: 'no_valid_interval' }
	}

	const totalFuelMl = intervals.reduce((sum, item) => sum + item.fuelMl, 0)
	const totalDistanceKm = intervals.reduce((sum, item) => sum + item.distanceKm, 0)
	const averageLitersPer100Km =
		(mlToLiters(totalFuelMl) / totalDistanceKm) * 100

	return {
		status: 'ok',
		intervals,
		averageLitersPer100Km,
	}
}

/**
 * Average consumption for intervals whose end fill falls inside [fromIso, toIso].
 * Still uses full-tank segments only — never invents partial-only rates.
 */
export function averageConsumptionForPeriod(
	entries: FuelEntry[],
	vehicleId: string,
	fromIso?: string,
	toIso?: string,
): AverageConsumptionForPeriod {
	const result = calculateConsumption(entries, vehicleId)

	if (result.status !== 'ok') {
		return {
			status: 'insufficient_data',
			intervalsUsed: 0,
			reason: result.reason,
		}
	}

	const byId = new Map(
		filterFuelEntriesByVehicle(entries, vehicleId).map((entry) => [
			entry.id,
			entry,
		]),
	)

	const selected = result.intervals.filter((interval) => {
		const end = byId.get(interval.endEntryId)

		if (!end) {
			return false
		}

		if (fromIso && end.recordedAt < fromIso) {
			return false
		}

		if (toIso && end.recordedAt > toIso) {
			return false
		}

		return true
	})

	if (selected.length === 0) {
		return {
			status: 'insufficient_data',
			intervalsUsed: 0,
			reason: 'no_valid_interval',
		}
	}

	const fuelMl = selected.reduce((sum, item) => sum + item.fuelMl, 0)
	const distanceKm = selected.reduce((sum, item) => sum + item.distanceKm, 0)
	const fuelLiters = mlToLiters(fuelMl)

	return {
		status: 'ok',
		distanceKm,
		fuelLiters,
		litersPer100Km: (fuelLiters / distanceKm) * 100,
		intervalsUsed: selected.length,
	}
}

function formatNumber(value: number): string {
	const rounded = Math.round(value * 1000) / 1000
	return String(rounded)
}
