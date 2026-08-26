import { err, ok, type DomainResult } from '@/domain/shared/result'
import type { FuelEntry } from './types'

/**
 * Sort key for fuel history math.
 * Creation order must never affect calculations — only odometer/time/id.
 */
export function compareFuelEntries(a: FuelEntry, b: FuelEntry): number {
	if (a.odometerKm !== b.odometerKm) {
		return a.odometerKm - b.odometerKm
	}

	if (a.recordedAt !== b.recordedAt) {
		return a.recordedAt < b.recordedAt ? -1 : 1
	}

	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortFuelEntries(entries: FuelEntry[]): FuelEntry[] {
	return [...entries].sort(compareFuelEntries)
}

export function filterFuelEntriesByVehicle(
	entries: FuelEntry[],
	vehicleId: string,
): FuelEntry[] {
	return entries.filter((entry) => entry.vehicleId === vehicleId)
}

/**
 * Compares entries in chronological event order.
 * Used for odometer sanity checks (not for consumption distance math).
 */
export function compareFuelEntriesByTime(a: FuelEntry, b: FuelEntry): number {
	if (a.recordedAt !== b.recordedAt) {
		return a.recordedAt < b.recordedAt ? -1 : 1
	}

	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Validates that odometer is strictly increasing along chronological neighbors.
 *
 * Allows forgotten fills inserted between existing dates when the km value
 * fits between those neighbors. Rejects a "new" fill dated after a 50 000 km
 * entry but recorded as 49 000 km.
 */
export function validateFuelOdometer(
	existing: FuelEntry[],
	candidate: Pick<FuelEntry, 'id' | 'vehicleId' | 'odometerKm' | 'recordedAt'>,
): DomainResult<true> {
	if (!Number.isFinite(candidate.odometerKm)) {
		return err({ code: 'NOT_FINITE', field: 'odometerKm' })
	}

	if (!Number.isInteger(candidate.odometerKm)) {
		return err({
			code: 'INVALID_FORMAT',
			field: 'odometerKm',
			details: { reason: 'must_be_integer_km' },
		})
	}

	if (candidate.odometerKm < 0) {
		return err({ code: 'NEGATIVE', field: 'odometerKm' })
	}

	if (candidate.odometerKm > 10_000_000) {
		return err({ code: 'TOO_LARGE', field: 'odometerKm' })
	}

	const others = existing.filter(
		(entry) =>
			entry.vehicleId === candidate.vehicleId && entry.id !== candidate.id,
	)

	const placeholder: FuelEntry = {
		id: candidate.id,
		vehicleId: candidate.vehicleId,
		recordedAt: candidate.recordedAt,
		odometerKm: candidate.odometerKm,
		litersMl: 1,
		totalCostKopecks: 1,
		pricePerLiterKopecks: 1,
		fullTank: false,
		createdAt: candidate.recordedAt,
		updatedAt: candidate.recordedAt,
	}

	const chronological = [...others, placeholder].sort(compareFuelEntriesByTime)
	const index = chronological.findIndex((entry) => entry.id === candidate.id)
	const previous = index > 0 ? chronological[index - 1] : undefined
	const next =
		index < chronological.length - 1 ? chronological[index + 1] : undefined

	if (previous && candidate.odometerKm < previous.odometerKm) {
		return err({
			code: 'ODOMETER_DECREASING',
			field: 'odometerKm',
			details: {
				previousOdometerKm: previous.odometerKm,
				candidateOdometerKm: candidate.odometerKm,
			},
		})
	}

	if (previous && candidate.odometerKm === previous.odometerKm) {
		return err({
			code: 'ODOMETER_NOT_INCREASING',
			field: 'odometerKm',
			details: {
				previousOdometerKm: previous.odometerKm,
				candidateOdometerKm: candidate.odometerKm,
			},
		})
	}

	if (next && candidate.odometerKm > next.odometerKm) {
		return err({
			code: 'ODOMETER_DECREASING',
			field: 'odometerKm',
			details: {
				nextOdometerKm: next.odometerKm,
				candidateOdometerKm: candidate.odometerKm,
			},
		})
	}

	if (next && candidate.odometerKm === next.odometerKm) {
		return err({
			code: 'ODOMETER_NOT_INCREASING',
			field: 'odometerKm',
			details: {
				nextOdometerKm: next.odometerKm,
				candidateOdometerKm: candidate.odometerKm,
			},
		})
	}

	return ok(true)
}
