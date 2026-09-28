/**
 * Pure share-report text builder for the active vehicle.
 * Omits metrics when underlying data is insufficient.
 */

import {
	STORE_APP_LINK_LABEL,
	STORE_APP_LISTING_URL,
} from '@/config/store-links'
import {
	aggregateCosts,
	calculateCostPerKm,
	monthPeriod,
} from '@/domain/expenses'
import type { Expense } from '@/domain/expenses/types'
import { calculateConsumption } from '@/domain/fuel'
import type { FuelEntry } from '@/domain/fuel/types'
import type { Vehicle } from '@/domain/vehicle/types'
import { kopecksToMajor } from '@/domain/shared/money'
import { formatConsumption, formatMoneyKopecks } from '@/ui/format'

export interface ShareReportInput {
	vehicle: Vehicle
	fuelEntries: FuelEntry[]
	expenses: Expense[]
	now?: Date
}

/** Builds a plain-text ownership summary for the system share sheet. */
export function buildShareReportText(input: ShareReportInput): string {
	const now = input.now ?? new Date()
	const month = monthPeriod(now.getFullYear(), now.getMonth() + 1)
	const monthLabel = now.toLocaleDateString('ru-RU', {
		month: 'long',
		year: 'numeric',
	})

	const lines: string[] = [
		`Автожурнал — ${input.vehicle.displayName}`,
		'',
		capitalize(monthLabel),
	]

	const consumption = calculateConsumption(
		input.fuelEntries,
		input.vehicle.id,
	)
	const monthCosts = aggregateCosts(
		input.fuelEntries,
		input.expenses,
		input.vehicle.id,
		month,
	)
	const costPerKm = calculateCostPerKm(
		input.fuelEntries,
		input.expenses,
		input.vehicle.id,
		month,
	)

	const distance = distanceForPeriod(
		input.fuelEntries,
		input.vehicle.id,
		month.fromIso,
		month.toIso,
	)
	if (distance !== undefined && distance > 0) {
		lines.push(`Пробег: ${distance.toLocaleString('ru-RU')} км`)
	}

	if (consumption.status === 'ok') {
		lines.push(
			`Средний расход: ${formatConsumption(consumption.averageLitersPer100Km)}`,
		)
	}

	if (monthCosts.fuelKopecks > 0) {
		lines.push(`Топливо: ${formatMoneyKopecks(monthCosts.fuelKopecks)}`)
	}
	if (monthCosts.nonFuelKopecks > 0) {
		lines.push(
			`Прочие расходы: ${formatMoneyKopecks(monthCosts.nonFuelKopecks)}`,
		)
	}
	if (monthCosts.totalKopecks > 0) {
		lines.push(`Всего: ${formatMoneyKopecks(monthCosts.totalKopecks)}`)
	}

	if (costPerKm.status === 'ok' && costPerKm.costPerKmMajor !== undefined) {
		lines.push(
			`Стоимость: ${kopecksToMajor(costPerKm.costPerKmKopecks ?? 0).toFixed(2).replace('.', ',')} ₽/км`,
		)
	}

	// Plain text has no hyperlink annotation. The caption is the user-facing
	// label; the URL on its own line is what Android share targets auto-link.
	lines.push('')
	lines.push(STORE_APP_LINK_LABEL)
	lines.push(STORE_APP_LISTING_URL)

	return lines.join('\n')
}

function capitalize(value: string): string {
	if (value.length === 0) {
		return value
	}
	return value.charAt(0).toUpperCase() + value.slice(1)
}

function distanceForPeriod(
	fuelEntries: FuelEntry[],
	vehicleId: string,
	fromIso?: string,
	toIso?: string,
): number | undefined {
	const points = fuelEntries
		.filter((entry) => entry.vehicleId === vehicleId)
		.filter((entry) => {
			if (fromIso && entry.recordedAt < fromIso) {
				return false
			}
			if (toIso && entry.recordedAt > toIso) {
				return false
			}
			return true
		})
		.map((entry) => entry.odometerKm)
		.sort((a, b) => a - b)

	if (points.length < 2) {
		return undefined
	}
	return points[points.length - 1] - points[0]
}
