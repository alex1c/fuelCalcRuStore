/**
 * Volume helpers — liters are stored as integer milliliters.
 */

/** Converts decimal liters to nearest milliliter. */
export function litersToMl(liters: number): number {
	return Math.round(liters * 1000)
}

/** Converts milliliters to liters (major volume unit). */
export function mlToLiters(ml: number): number {
	return ml / 1000
}
