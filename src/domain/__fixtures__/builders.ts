import type { FuelEntry } from '@/domain/fuel/types'
import type { Expense } from '@/domain/expenses/types'

let seq = 0

/** Builds a fuel entry with sensible defaults for domain tests. */
export function fuelEntry(
	overrides: Partial<FuelEntry> &
		Pick<FuelEntry, 'id' | 'vehicleId' | 'odometerKm' | 'litersMl' | 'fullTank'>,
): FuelEntry {
	seq += 1
	const recordedAt = overrides.recordedAt ?? `2026-01-${String((seq % 28) + 1).padStart(2, '0')}T12:00:00.000Z`

	return {
		totalCostKopecks: overrides.totalCostKopecks ?? overrides.litersMl, // 1 kopeck/ml placeholder
		pricePerLiterKopecks: overrides.pricePerLiterKopecks ?? 5000,
		createdAt: overrides.createdAt ?? recordedAt,
		updatedAt: overrides.updatedAt ?? recordedAt,
		recordedAt,
		...overrides,
	}
}

export function expense(
	overrides: Partial<Expense> &
		Pick<Expense, 'id' | 'vehicleId' | 'amountKopecks' | 'category'>,
): Expense {
	seq += 1
	const recordedAt = overrides.recordedAt ?? `2026-02-${String((seq % 28) + 1).padStart(2, '0')}T12:00:00.000Z`

	return {
		createdAt: overrides.createdAt ?? recordedAt,
		updatedAt: overrides.updatedAt ?? recordedAt,
		recordedAt,
		...overrides,
	}
}
