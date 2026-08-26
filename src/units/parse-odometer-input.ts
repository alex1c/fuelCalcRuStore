/**
 * Strict integer-kilometer parser for odometer fields.
 * V1 uses whole kilometers only — no decimals, no junk suffixes.
 */

import type { ParseDecimalInputErrorCode } from './parse-decimal-input'

export type ParseOdometerResult =
	| { ok: true; valueKm: number }
	| { ok: false; code: ParseDecimalInputErrorCode }

const MAX_ODOMETER_KM = 10_000_000

/**
 * Parses user odometer text to an integer kilometer value.
 *
 * Allowed:
 * - `10000`
 * - `10 000` (spaces are stripped explicitly, then digits-only checked)
 *
 * Rejected:
 * - empty
 * - `10000abc`
 * - `10000.5` / `10000,5`
 * - negatives
 */
export function parseOdometerKm(raw: string): ParseOdometerResult {
	const trimmed = raw.trim()

	if (trimmed.length === 0) {
		return { ok: false, code: 'EMPTY' }
	}

	// Explicitly allow grouped thousands with spaces only (e.g. "10 000").
	const withoutSpaces = trimmed.replace(/ /g, '')

	if (!/^\d+$/.test(withoutSpaces)) {
		return { ok: false, code: 'INVALID_FORMAT' }
	}

	const valueKm = Number(withoutSpaces)

	if (!Number.isFinite(valueKm)) {
		return { ok: false, code: 'NOT_FINITE' }
	}

	if (!Number.isInteger(valueKm)) {
		return { ok: false, code: 'INVALID_FORMAT' }
	}

	if (valueKm < 0) {
		return { ok: false, code: 'NEGATIVE' }
	}

	if (valueKm > MAX_ODOMETER_KM) {
		return { ok: false, code: 'TOO_LARGE' }
	}

	return { ok: true, valueKm }
}
