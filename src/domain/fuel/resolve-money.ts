import {
	majorToKopecks,
	priceFromLitersAndTotal,
	totalFromLitersAndPrice,
} from '@/domain/shared/money'
import { err, ok, type DomainResult } from '@/domain/shared/result'
import { litersToMl } from '@/domain/shared/volume'
import type { FuelMoneyInput, ResolvedFuelMoney } from './types'

const MAX_LITERS = 10_000
const MAX_PRICE_MAJOR = 1_000_000
const MAX_TOTAL_MAJOR = 10_000_000

/**
 * Resolves fuel money/volume into canonical integer fields.
 * Mode A and Mode B share one representation: litersMl + totalCostKopecks.
 */
export function resolveFuelMoney(
	input: FuelMoneyInput,
): DomainResult<ResolvedFuelMoney> {
	if (!Number.isFinite(input.liters)) {
		return err({ code: 'NOT_FINITE', field: 'liters' })
	}

	if (input.liters <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'liters' })
	}

	if (input.liters > MAX_LITERS) {
		return err({ code: 'TOO_LARGE', field: 'liters', details: { max: MAX_LITERS } })
	}

	const litersMl = litersToMl(input.liters)

	if (litersMl <= 0) {
		return err({ code: 'TOO_SMALL', field: 'liters' })
	}

	if (input.mode === 'liters_and_price') {
		if (!Number.isFinite(input.pricePerLiter)) {
			return err({ code: 'NOT_FINITE', field: 'pricePerLiter' })
		}

		if (input.pricePerLiter <= 0) {
			return err({ code: 'NOT_POSITIVE', field: 'pricePerLiter' })
		}

		if (input.pricePerLiter > MAX_PRICE_MAJOR) {
			return err({
				code: 'TOO_LARGE',
				field: 'pricePerLiter',
				details: { max: MAX_PRICE_MAJOR },
			})
		}

		const pricePerLiterKopecks = majorToKopecks(input.pricePerLiter)
		const totalCostKopecks = totalFromLitersAndPrice(
			litersMl,
			pricePerLiterKopecks,
		)

		if (totalCostKopecks <= 0) {
			return err({ code: 'TOO_SMALL', field: 'totalCost' })
		}

		return ok({
			litersMl,
			totalCostKopecks,
			pricePerLiterKopecks,
		})
	}

	if (!Number.isFinite(input.totalCost)) {
		return err({ code: 'NOT_FINITE', field: 'totalCost' })
	}

	if (input.totalCost <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'totalCost' })
	}

	if (input.totalCost > MAX_TOTAL_MAJOR) {
		return err({
			code: 'TOO_LARGE',
			field: 'totalCost',
			details: { max: MAX_TOTAL_MAJOR },
		})
	}

	const totalCostKopecks = majorToKopecks(input.totalCost)
	const pricePerLiterKopecks = priceFromLitersAndTotal(
		litersMl,
		totalCostKopecks,
	)

	if (pricePerLiterKopecks <= 0) {
		return err({ code: 'TOO_SMALL', field: 'pricePerLiter' })
	}

	return ok({
		litersMl,
		totalCostKopecks,
		pricePerLiterKopecks,
	})
}
