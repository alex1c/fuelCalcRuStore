/**
 * Structured domain errors — UI maps codes to i18n later.
 * Never embed user-facing copy here.
 */

export type DomainErrorCode =
	| 'EMPTY'
	| 'INVALID_FORMAT'
	| 'NOT_POSITIVE'
	| 'NOT_FINITE'
	| 'NEGATIVE'
	| 'TOO_LARGE'
	| 'TOO_SMALL'
	| 'ODOMETER_DECREASING'
	| 'ODOMETER_NOT_INCREASING'
	| 'FUEL_EXPENSE_NOT_ALLOWED'
	| 'MISSING_FIELD'
	| 'INVALID_CATEGORY'
	| 'INSUFFICIENT_DATA'
	| 'ZERO_DISTANCE'

export interface DomainError {
	code: DomainErrorCode
	field?: string
	/** Optional machine-readable details for debugging / future UI. */
	details?: Record<string, string | number | boolean | null>
}

export type DomainResult<T> =
	| { ok: true; value: T }
	| { ok: false; errors: DomainError[] }

export function ok<T>(value: T): DomainResult<T> {
	return { ok: true, value }
}

export function err<T = never>(...errors: DomainError[]): DomainResult<T> {
	return { ok: false, errors }
}
