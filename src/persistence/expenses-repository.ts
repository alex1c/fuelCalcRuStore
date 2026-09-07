import type { Expense } from '@/domain/expenses/types'
import { withDatabase } from './database'
import { mapExpenseRow, type ExpenseRow } from './mappers'

export async function listExpenses(vehicleId?: string): Promise<Expense[]> {
	return withDatabase(async (db) => {
		if (vehicleId) {
			const rows = await db.getAllAsync<ExpenseRow>(
				`SELECT * FROM expenses
				 WHERE vehicle_id = ?
				 ORDER BY recorded_at DESC, id DESC;`,
				[vehicleId],
			)
			return rows.map(mapExpenseRow)
		}

		const rows = await db.getAllAsync<ExpenseRow>(
			`SELECT * FROM expenses ORDER BY recorded_at DESC, id DESC;`,
		)
		return rows.map(mapExpenseRow)
	})
}

export async function getExpenseById(id: string): Promise<Expense | null> {
	return withDatabase(async (db) => {
		const row = await db.getFirstAsync<ExpenseRow>(
			`SELECT * FROM expenses WHERE id = ?;`,
			[id],
		)
		return row ? mapExpenseRow(row) : null
	})
}

export async function upsertExpense(expense: Expense): Promise<void> {
	return withDatabase(async (db) => {
		await db.runAsync(
			`INSERT INTO expenses (
				id, vehicle_id, recorded_at, odometer_km, amount_kopecks,
				category, note, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				vehicle_id = excluded.vehicle_id,
				recorded_at = excluded.recorded_at,
				odometer_km = excluded.odometer_km,
				amount_kopecks = excluded.amount_kopecks,
				category = excluded.category,
				note = excluded.note,
				updated_at = excluded.updated_at;`,
			[
				expense.id,
				expense.vehicleId,
				expense.recordedAt,
				expense.odometerKm ?? null,
				expense.amountKopecks,
				expense.category,
				expense.note ?? null,
				expense.createdAt,
				expense.updatedAt,
			],
		)
	})
}

export async function deleteExpense(id: string): Promise<void> {
	return withDatabase(async (db) => {
		await db.runAsync(`DELETE FROM expenses WHERE id = ?;`, [id])
	})
}
