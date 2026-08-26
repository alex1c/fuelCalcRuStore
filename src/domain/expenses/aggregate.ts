import type { FuelEntry } from '@/domain/fuel/types'
import { filterFuelEntriesByVehicle } from '@/domain/fuel/validate'
import { kopecksToMajor } from '@/domain/shared/money'
import type { ExpenseCategory } from '@/domain/shared/types'
import type { Expense } from './types'

export interface PeriodFilter {
	fromIso?: string
	toIso?: string
}

export interface CostBreakdown {
	totalKopecks: number
	fuelKopecks: number
	nonFuelKopecks: number
	byCategory: Record<ExpenseCategory, number>
	/** Major units mirrors for explainability / UI. */
	totalMajor: number
	fuelMajor: number
	nonFuelMajor: number
}

export interface CostPerKmResult {
	status: 'ok' | 'insufficient_data'
	reason?: 'no_costs' | 'zero_distance' | 'no_odometer_span'
	costPerKmKopecks?: number
	costPerKmMajor?: number
	explanation?: {
		totalKopecks: number
		distanceKm: number
		formula: string
	}
}

function inPeriod(iso: string, period?: PeriodFilter): boolean {
	if (!period) {
		return true
	}

	if (period.fromIso && iso < period.fromIso) {
		return false
	}

	if (period.toIso && iso > period.toIso) {
		return false
	}

	return true
}

function emptyByCategory(): Record<ExpenseCategory, number> {
	return {
		fuel: 0,
		maintenance: 0,
		repair: 0,
		parts: 0,
		insurance: 0,
		washing: 0,
		parking: 0,
		fines: 0,
		tires: 0,
		tax: 0,
		other: 0,
	}
}

/**
 * Aggregates ownership costs without double-counting fuel.
 * Fuel money comes only from fuel entries; expense.category=fuel is not used.
 */
export function aggregateCosts(
	fuelEntries: FuelEntry[],
	expenses: Expense[],
	vehicleId: string,
	period?: PeriodFilter,
): CostBreakdown {
	const byCategory = emptyByCategory()

	const fuelKopecks = filterFuelEntriesByVehicle(fuelEntries, vehicleId)
		.filter((entry) => inPeriod(entry.recordedAt, period))
		.reduce((sum, entry) => {
			byCategory.fuel += entry.totalCostKopecks
			return sum + entry.totalCostKopecks
		}, 0)

	const nonFuelKopecks = expenses
		.filter((expense) => expense.vehicleId === vehicleId)
		.filter((expense) => inPeriod(expense.recordedAt, period))
		.reduce((sum, expense) => {
			if (expense.category === 'fuel') {
				// Defensive: ignore illegal fuel expenses if they somehow exist.
				return sum
			}

			byCategory[expense.category] += expense.amountKopecks
			return sum + expense.amountKopecks
		}, 0)

	const totalKopecks = fuelKopecks + nonFuelKopecks

	return {
		totalKopecks,
		fuelKopecks,
		nonFuelKopecks,
		byCategory,
		totalMajor: kopecksToMajor(totalKopecks),
		fuelMajor: kopecksToMajor(fuelKopecks),
		nonFuelMajor: kopecksToMajor(nonFuelKopecks),
	}
}

/**
 * Cost per km = total ownership costs / odometer span from fuel entries in scope.
 */
export function calculateCostPerKm(
	fuelEntries: FuelEntry[],
	expenses: Expense[],
	vehicleId: string,
	period?: PeriodFilter,
): CostPerKmResult {
	const costs = aggregateCosts(fuelEntries, expenses, vehicleId, period)

	if (costs.totalKopecks <= 0) {
		return { status: 'insufficient_data', reason: 'no_costs' }
	}

	const odometers = filterFuelEntriesByVehicle(fuelEntries, vehicleId)
		.filter((entry) => inPeriod(entry.recordedAt, period))
		.map((entry) => entry.odometerKm)

	if (odometers.length < 2) {
		return { status: 'insufficient_data', reason: 'no_odometer_span' }
	}

	const minKm = Math.min(...odometers)
	const maxKm = Math.max(...odometers)
	const distanceKm = maxKm - minKm

	if (distanceKm <= 0) {
		return { status: 'insufficient_data', reason: 'zero_distance' }
	}

	const costPerKmKopecks = costs.totalKopecks / distanceKm

	return {
		status: 'ok',
		costPerKmKopecks,
		costPerKmMajor: kopecksToMajor(costPerKmKopecks),
		explanation: {
			totalKopecks: costs.totalKopecks,
			distanceKm,
			formula: `${kopecksToMajor(costs.totalKopecks)} / ${distanceKm}`,
		},
	}
}

/** Convenience: calendar month [from, to] as ISO bounds (inclusive strings). */
export function monthPeriod(year: number, month1to12: number): PeriodFilter {
	const fromIso = `${year}-${pad(month1to12)}-01T00:00:00.000Z`
	const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
	const toIso = `${year}-${pad(month1to12)}-${pad(lastDay)}T23:59:59.999Z`
	return { fromIso, toIso }
}

export function yearPeriod(year: number): PeriodFilter {
	return {
		fromIso: `${year}-01-01T00:00:00.000Z`,
		toIso: `${year}-12-31T23:59:59.999Z`,
	}
}

function pad(value: number): string {
	return value < 10 ? `0${value}` : String(value)
}
