import { kopecksToMajor } from '@/domain/shared/money'
import { mlToLiters } from '@/domain/shared/volume'

/** Formats liters for UI (up to 3 decimals, trims trailing zeros). */
export function formatLiters(litersMl: number): string {
	const liters = mlToLiters(litersMl)
	return trimDecimals(liters, 3)
}

/** Formats money major units with 2 decimals and ₽. */
export function formatMoneyKopecks(kopecks: number): string {
	return `${kopecksToMajor(kopecks).toFixed(2)} ₽`
}

/** Formats л/100 км for display. */
export function formatConsumption(litersPer100Km: number): string {
	return `${trimDecimals(litersPer100Km, 2)} л/100 км`
}

export function formatOdometer(km: number): string {
	return `${km.toLocaleString('ru-RU')} км`
}

function trimDecimals(value: number, maxDigits: number): string {
	const fixed = value.toFixed(maxDigits)
	return fixed.replace(/\.?0+$/, '')
}
