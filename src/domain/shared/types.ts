/** ISO-like currency code; presenter maps to a display symbol later. */
export type CurrencyCode = 'RUB'

/** Domain fuel type metadata — not used in math in Phase 0–1. */
export type FuelType =
	| 'petrol92'
	| 'petrol95'
	| 'petrol98'
	| 'diesel'
	| 'lpg'
	| 'electric'
	| 'other'

export type ExpenseCategory =
	| 'fuel'
	| 'maintenance'
	| 'repair'
	| 'parts'
	| 'insurance'
	| 'washing'
	| 'parking'
	| 'fines'
	| 'tires'
	| 'tax'
	| 'other'

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
	'fuel',
	'maintenance',
	'repair',
	'parts',
	'insurance',
	'washing',
	'parking',
	'fines',
	'tires',
	'tax',
	'other',
] as const

/** Non-fuel categories allowed on expense records in V1. */
export const EXPENSE_RECORD_CATEGORIES: readonly Exclude<ExpenseCategory, 'fuel'>[] = [
	'maintenance',
	'repair',
	'parts',
	'insurance',
	'washing',
	'parking',
	'fines',
	'tires',
	'tax',
	'other',
] as const
