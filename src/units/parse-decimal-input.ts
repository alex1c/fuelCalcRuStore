/**
 * Locale-aware decimal parsing for user text input.
 * Accepts both `8.5` and `8,5` as the same numeric value.
 */

export type ParseDecimalInputErrorCode =
	| 'EMPTY'
	| 'INVALID_FORMAT'
	| 'NOT_POSITIVE'
	| 'NOT_FINITE'
	| 'NEGATIVE'
	| 'TOO_LARGE'

export type ParseDecimalNumberResult =
	| { ok: true; value: number }
	| { ok: false; code: ParseDecimalInputErrorCode }

/**
 * Trims whitespace and converts a decimal comma to a dot.
 * Does not invent a number from incomplete drafts such as `4,`.
 */
export function normalizeDecimalInput(raw: string): string {
	return raw.trim().replace(',', '.')
}

/**
 * Parses a user decimal string to a finite number.
 * Accepts `4`, `4.5`, `4,5`. Rejects empty, `4,`, NaN, Infinity, and junk.
 */
export function parseUserDecimalNumber(
	raw: string,
	options: { allowZero?: boolean; allowNegative?: boolean } = {},
): ParseDecimalNumberResult {
	const trimmed = raw.trim()

	if (trimmed.length === 0) {
		return { ok: false, code: 'EMPTY' }
	}

	const normalized = normalizeDecimalInput(trimmed)

	if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
		return { ok: false, code: 'INVALID_FORMAT' }
	}

	const value = Number(normalized)

	if (!Number.isFinite(value)) {
		return { ok: false, code: 'NOT_FINITE' }
	}

	if (value < 0 && !options.allowNegative) {
		return { ok: false, code: 'NEGATIVE' }
	}

	if (!options.allowZero && value === 0) {
		return { ok: false, code: 'NOT_POSITIVE' }
	}

	return { ok: true, value }
}
