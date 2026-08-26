/**
 * Integer money helpers — amounts are stored in minor units (kopecks for RUB).
 * Avoids floating-point artefacts in user-facing money results.
 */

/** Rounds a major-unit amount (e.g. rubles) to integer kopecks. */
export function majorToKopecks(major: number): number {
	return Math.round(major * 100)
}

/** Converts kopecks to major units for display / explanation. */
export function kopecksToMajor(kopecks: number): number {
	return kopecks / 100
}

/** Rounds an already-scaled kopeck quantity to the nearest integer kopeck. */
export function roundKopecks(value: number): number {
	return Math.round(value)
}

/**
 * Mode A: liters (ml) + price per liter (kopecks) → total cost (kopecks).
 * Integer path: (ml * priceKopecks) / 1000, then round to kopecks.
 */
export function totalFromLitersAndPrice(
	litersMl: number,
	pricePerLiterKopecks: number,
): number {
	return roundKopecks((litersMl * pricePerLiterKopecks) / 1000)
}

/**
 * Mode B: liters (ml) + total (kopecks) → price per liter (kopecks).
 * Returns 0 when volume is zero (caller should validate liters > 0).
 */
export function priceFromLitersAndTotal(
	litersMl: number,
	totalCostKopecks: number,
): number {
	if (litersMl <= 0) {
		return 0
	}

	return roundKopecks((totalCostKopecks * 1000) / litersMl)
}
