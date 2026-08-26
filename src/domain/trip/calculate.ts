import {
	kopecksToMajor,
	majorToKopecks,
	totalFromLitersAndPrice,
} from '@/domain/shared/money'
import { err, ok, type DomainResult } from '@/domain/shared/result'
import { litersToMl, mlToLiters } from '@/domain/shared/volume'

export interface TripFuelEstimateInput {
	distanceKm: number
	/** л/100 км */
	fuelConsumption: number
	/** Major units per liter (e.g. RUB/L). */
	fuelPrice: number
}

export interface TripFuelEstimate {
	estimatedLiters: number
	estimatedLitersMl: number
	estimatedFuelCostKopecks: number
	estimatedFuelCostMajor: number
	explanation: {
		formulaLiters: string
		formulaCost: string
	}
}

export interface TripOwnershipEstimateInput {
	distanceKm: number
	/** Major units per km from a valid cost/km result. */
	costPerKmMajor: number
}

export interface TripOwnershipEstimate {
	estimatedOwnershipCostKopecks: number
	estimatedOwnershipCostMajor: number
	explanation: {
		formula: string
	}
}

/**
 * Estimates fuel volume and fuel-only cost for a trip.
 * Separate from ownership cost × distance.
 */
export function estimateTripFuel(
	input: TripFuelEstimateInput,
): DomainResult<TripFuelEstimate> {
	if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'distanceKm' })
	}

	if (!Number.isFinite(input.fuelConsumption) || input.fuelConsumption <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'fuelConsumption' })
	}

	if (!Number.isFinite(input.fuelPrice) || input.fuelPrice <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'fuelPrice' })
	}

	const estimatedLiters = (input.distanceKm * input.fuelConsumption) / 100
	const estimatedLitersMl = litersToMl(estimatedLiters)
	const priceKopecks = majorToKopecks(input.fuelPrice)
	const estimatedFuelCostKopecks = totalFromLitersAndPrice(
		estimatedLitersMl,
		priceKopecks,
	)

	return ok({
		estimatedLiters: mlToLiters(estimatedLitersMl),
		estimatedLitersMl,
		estimatedFuelCostKopecks,
		estimatedFuelCostMajor: kopecksToMajor(estimatedFuelCostKopecks),
		explanation: {
			formulaLiters: `${input.distanceKm} × ${input.fuelConsumption} / 100`,
			formulaCost: `${mlToLiters(estimatedLitersMl)} × ${input.fuelPrice}`,
		},
	})
}

/**
 * Real trip cost estimate using ownership ₽/км.
 * Must stay separate from fuel-only estimate in any UI.
 */
export function estimateTripOwnershipCost(
	input: TripOwnershipEstimateInput,
): DomainResult<TripOwnershipEstimate> {
	if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'distanceKm' })
	}

	if (!Number.isFinite(input.costPerKmMajor) || input.costPerKmMajor <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'costPerKmMajor' })
	}

	const estimatedOwnershipCostKopecks = majorToKopecks(
		input.distanceKm * input.costPerKmMajor,
	)

	return ok({
		estimatedOwnershipCostKopecks,
		estimatedOwnershipCostMajor: kopecksToMajor(estimatedOwnershipCostKopecks),
		explanation: {
			formula: `${input.distanceKm} × ${input.costPerKmMajor}`,
		},
	})
}
