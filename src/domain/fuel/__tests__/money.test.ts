import { resolveFuelMoney } from '@/domain/fuel/resolve-money'
import {
	kopecksToMajor,
	priceFromLitersAndTotal,
	totalFromLitersAndPrice,
} from '@/domain/shared/money'
import { litersToMl } from '@/domain/shared/volume'

describe('fuel money resolution', () => {
	it('mode A: liters + price → total without float artefacts', () => {
		const result = resolveFuelMoney({
			mode: 'liters_and_price',
			liters: 40,
			pricePerLiter: 56.49,
		})

		expect(result.ok).toBe(true)
		if (!result.ok) {
			return
		}

		expect(result.value.litersMl).toBe(40_000)
		expect(result.value.pricePerLiterKopecks).toBe(5649)
		expect(result.value.totalCostKopecks).toBe(
			totalFromLitersAndPrice(40_000, 5649),
		)
		expect(kopecksToMajor(result.value.totalCostKopecks)).toBe(2259.6)
	})

	it('mode B: liters + total → price', () => {
		const result = resolveFuelMoney({
			mode: 'liters_and_total',
			liters: 40,
			totalCost: 2259.6,
		})

		expect(result.ok).toBe(true)
		if (!result.ok) {
			return
		}

		expect(result.value.litersMl).toBe(40_000)
		expect(result.value.totalCostKopecks).toBe(225_960)
		expect(result.value.pricePerLiterKopecks).toBe(
			priceFromLitersAndTotal(40_000, 225_960),
		)
	})

	it('rejects zero and negative liters', () => {
		expect(
			resolveFuelMoney({ mode: 'liters_and_price', liters: 0, pricePerLiter: 50 }).ok,
		).toBe(false)
		expect(
			resolveFuelMoney({ mode: 'liters_and_total', liters: -1, totalCost: 100 }).ok,
		).toBe(false)
	})

	it('rejects very small liters that round to 0 ml', () => {
		const result = resolveFuelMoney({
			mode: 'liters_and_price',
			liters: 0.0001,
			pricePerLiter: 50,
		})
		expect(result.ok).toBe(false)
	})

	it('litersToMl rounds to nearest milliliter', () => {
		expect(litersToMl(8.5)).toBe(8500)
		expect(litersToMl(8.5004)).toBe(8500)
		expect(litersToMl(8.5006)).toBe(8501)
	})
})
