import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	normalizeAndValidateExpense,
	type ExpenseDraft,
} from '@/domain/expenses'
import type { ExpenseCategory } from '@/domain/shared/types'
import { kopecksToMajor } from '@/domain/shared/money'
import { parseOdometerKm, parseUserDecimalNumber } from '@/units'
import {
	createId,
	deleteExpense,
	getExpenseById,
	upsertExpense,
} from '@/persistence'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import {
	Chip,
	Field,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/ui/components'
import { describeDomainError } from '@/ui/domain-errors'
import { EXPENSE_CATEGORY_OPTIONS } from '@/ui/labels'

/** Add / edit a non-fuel expense. */
export function ExpenseEditScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const editingId = typeof params.id === 'string' ? params.id : undefined
	const { activeVehicle, refresh } = useJournal()

	const [category, setCategory] =
		useState<Exclude<ExpenseCategory, 'fuel'>>('washing')
	const [amount, setAmount] = useState('')
	const [dateLocal, setDateLocal] = useState(toDateInput(new Date()))
	const [odometer, setOdometer] = useState('')
	const [note, setNote] = useState('')
	const [createdAt, setCreatedAt] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})

	useEffect(() => {
		if (!editingId) {
			return
		}
		void (async () => {
			const expense = await getExpenseById(editingId)
			if (!expense || expense.category === 'fuel') {
				return
			}
			setCategory(expense.category)
			setAmount(String(kopecksToMajor(expense.amountKopecks)).replace('.', ','))
			setDateLocal(toDateInput(new Date(expense.recordedAt)))
			setOdometer(
				expense.odometerKm !== undefined ? String(expense.odometerKm) : '',
			)
			setNote(expense.note ?? '')
			setCreatedAt(expense.createdAt)
		})()
	}, [editingId])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>Расход</Text>
				<Text style={styles.muted}>Сначала выберите автомобиль.</Text>
			</Screen>
		)
	}

	async function handleSave() {
		if (!activeVehicle) {
			return
		}

		const nextErrors: Record<string, string> = {}
		const amountParsed = parseUserDecimalNumber(amount)
		if (!amountParsed.ok) {
			nextErrors.amount = describeDomainError(amountParsed.code, 'amount')
		}

		const recordedAt = fromDateInput(dateLocal)
		if (!recordedAt) {
			nextErrors.date = 'Формат: ГГГГ-ММ-ДД'
		}

		let odometerKm: number | undefined
		if (odometer.trim().length > 0) {
			const odo = parseOdometerKm(odometer)
			if (!odo.ok) {
				nextErrors.odometer = describeDomainError(odo.code, 'odometerKm')
			} else {
				odometerKm = odo.valueKm
			}
		}

		if (Object.keys(nextErrors).length > 0 || !amountParsed.ok || !recordedAt) {
			setErrors(nextErrors)
			return
		}

		const now = new Date().toISOString()
		const draft: ExpenseDraft = {
			id: editingId ?? createId(),
			vehicleId: activeVehicle.id,
			recordedAt,
			odometerKm,
			amount: amountParsed.value,
			category,
			note: note.trim() || undefined,
			createdAt: createdAt ?? now,
			updatedAt: now,
		}

		const validated = normalizeAndValidateExpense(draft)
		if (!validated.ok) {
			const first = validated.errors[0]
			setErrors({
				[first.field ?? 'amount']: describeDomainError(first.code, first.field),
			})
			return
		}

		setErrors({})
		setSaving(true)
		try {
			await upsertExpense(validated.value)
			await refresh()
			router.back()
		} catch (err) {
			Alert.alert('Ошибка', err instanceof Error ? err.message : 'Не удалось сохранить')
		} finally {
			setSaving(false)
		}
	}

	function handleDelete() {
		if (!editingId) {
			return
		}
		Alert.alert('Удалить расход?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await deleteExpense(editingId)
						await refresh()
						router.back()
					})()
				},
			},
		])
	}

	return (
		<Screen>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: spacing.xl }}
			>
				<Text style={styles.title}>
					{editingId ? 'Редактирование расхода' : 'Новый расход'}
				</Text>

				<Text style={styles.label}>Категория</Text>
				<View style={styles.chips}>
					{EXPENSE_CATEGORY_OPTIONS.map(([value, label]) => (
						<Chip
							key={value}
							label={label}
							selected={category === value}
							onPress={() => setCategory(value)}
						/>
					))}
				</View>

				<Field
					label="Сумма, ₽ *"
					value={amount}
					onChangeText={setAmount}
					keyboardType="decimal-pad"
					placeholder="1000"
					error={errors.amount}
				/>
				<Field
					label="Дата (ГГГГ-ММ-ДД)"
					value={dateLocal}
					onChangeText={setDateLocal}
					error={errors.date}
				/>
				<Field
					label="Пробег, км (необяз.)"
					value={odometer}
					onChangeText={setOdometer}
					keyboardType="number-pad"
					error={errors.odometer}
				/>
				<Field
					label="Заметка"
					value={note}
					onChangeText={setNote}
					placeholder="Опционально"
				/>

				<PrimaryButton
					label={saving ? 'Сохранение…' : 'Сохранить'}
					onPress={() => {
						void handleSave()
					}}
					disabled={saving}
				/>
				{editingId ? (
					<SecondaryButton label="Удалить" onPress={handleDelete} />
				) : null}
			</ScrollView>
		</Screen>
	)
}

function toDateInput(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromDateInput(raw: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
	if (!match) {
		return null
	}
	const [, y, m, d] = match
	const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0)
	if (Number.isNaN(date.getTime())) {
		return null
	}
	return date.toISOString()
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	label: {
		fontSize: 13,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: spacing.md,
	},
	muted: {
		color: colors.textMuted,
	},
})
