import { majorToKopecks } from '@/domain/shared/money'
import { err, ok, type DomainResult } from '@/domain/shared/result'
import { EXPENSE_RECORD_CATEGORIES } from '@/domain/shared/types'
import type { Expense, ExpenseDraft } from './types'

/**
 * Validates and normalizes an expense draft.
 * Category `fuel` is rejected — fuel money lives on fuel entries only.
 */
export function normalizeAndValidateExpense(
	draft: ExpenseDraft,
): DomainResult<Expense> {
	if (!draft.vehicleId) {
		return err({ code: 'MISSING_FIELD', field: 'vehicleId' })
	}

	if (!draft.recordedAt) {
		return err({ code: 'MISSING_FIELD', field: 'recordedAt' })
	}

	if (draft.category === 'fuel') {
		return err({
			code: 'FUEL_EXPENSE_NOT_ALLOWED',
			field: 'category',
			details: { reason: 'use_fuel_entry' },
		})
	}

	if (
		!EXPENSE_RECORD_CATEGORIES.includes(
			draft.category as (typeof EXPENSE_RECORD_CATEGORIES)[number],
		)
	) {
		return err({ code: 'INVALID_CATEGORY', field: 'category' })
	}

	if (!Number.isFinite(draft.amount)) {
		return err({ code: 'NOT_FINITE', field: 'amount' })
	}

	if (draft.amount <= 0) {
		return err({ code: 'NOT_POSITIVE', field: 'amount' })
	}

	if (draft.amount > 100_000_000) {
		return err({ code: 'TOO_LARGE', field: 'amount' })
	}

	if (draft.odometerKm !== undefined) {
		if (!Number.isFinite(draft.odometerKm) || !Number.isInteger(draft.odometerKm)) {
			return err({ code: 'INVALID_FORMAT', field: 'odometerKm' })
		}

		if (draft.odometerKm < 0) {
			return err({ code: 'NEGATIVE', field: 'odometerKm' })
		}
	}

	return ok({
		id: draft.id,
		vehicleId: draft.vehicleId,
		recordedAt: draft.recordedAt,
		odometerKm: draft.odometerKm,
		amountKopecks: majorToKopecks(draft.amount),
		category: draft.category,
		note: draft.note,
		createdAt: draft.createdAt,
		updatedAt: draft.updatedAt,
	})
}
