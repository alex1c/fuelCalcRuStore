import type { ExpenseCategory } from '@/domain/shared/types'

export interface Expense {
	id: string
	vehicleId: string
	recordedAt: string
	odometerKm?: number
	amountKopecks: number
	category: ExpenseCategory
	note?: string
	createdAt: string
	updatedAt: string
}

export interface ExpenseDraft {
	id: string
	vehicleId: string
	recordedAt: string
	odometerKm?: number
	/** Major currency units (e.g. rubles). */
	amount: number
	category: ExpenseCategory
	note?: string
	createdAt: string
	updatedAt: string
}
