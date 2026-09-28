import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	completeMaintenance,
	type MaintenanceItem,
} from '@/domain/maintenance'
import { parseOdometerKm, parseUserDecimalNumber } from '@/units'
import {
	createId,
	deleteMaintenance,
	getMaintenanceById,
	upsertMaintenance,
} from '@/persistence'
import {
	cancelMaintenanceReminders,
	ensureNotificationPermission,
	syncMaintenanceReminders,
} from '@/notifications/reminders-service'
import { getAnalyticsService } from '@/services/analytics'
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
import { MAINTENANCE_SUGGESTIONS } from '@/ui/labels'

/** Create / edit / complete a maintenance item. */
export function MaintenanceEditScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const editingId = typeof params.id === 'string' ? params.id : undefined
	const { activeVehicle, refresh } = useJournal()

	const [title, setTitle] = useState('')
	const [lastDate, setLastDate] = useState(() => toDateInput(new Date()))
	const [lastOdo, setLastOdo] = useState(() =>
		activeVehicle ? String(activeVehicle.currentOdometerKm) : '',
	)
	// Sensible default interval so new items are immediately due-aware.
	const [intervalKm, setIntervalKm] = useState('10000')
	const [intervalDays, setIntervalDays] = useState('')
	const [note, setNote] = useState('')
	const [active, setActive] = useState(true)
	const [remind, setRemind] = useState(false)
	const [createdAt, setCreatedAt] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})

	useEffect(() => {
		if (!editingId) {
			return
		}
		// Load existing maintenance row from SQLite; setState after await is intentional.
		void (async () => {
			const item = await getMaintenanceById(editingId)
			if (!item) {
				return
			}
			setTitle(item.title)
			setLastDate(item.lastServiceDate ? toDateInput(new Date(item.lastServiceDate)) : '')
			setLastOdo(
				item.lastServiceOdometerKm !== undefined
					? String(item.lastServiceOdometerKm)
					: '',
			)
			setIntervalKm(item.intervalKm !== undefined ? String(item.intervalKm) : '')
			setIntervalDays(
				item.intervalDays !== undefined ? String(item.intervalDays) : '',
			)
			setNote(item.note ?? '')
			setActive(item.active)
			setRemind(item.remind)
			setCreatedAt(item.createdAt)
		})()
	}, [editingId])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>ТО</Text>
				<Text style={styles.muted}>Сначала выберите автомобиль.</Text>
			</Screen>
		)
	}

	function buildItem(now: string): MaintenanceItem | null {
		if (!activeVehicle) {
			return null
		}
		const nextErrors: Record<string, string> = {}
		const trimmedTitle = title.trim()
		if (!trimmedTitle) {
			nextErrors.title = 'Укажите название'
		}

		let lastServiceOdometerKm: number | undefined
		if (lastOdo.trim()) {
			const odo = parseOdometerKm(lastOdo)
			if (!odo.ok) {
				nextErrors.lastOdo = describeDomainError(odo.code)
			} else {
				lastServiceOdometerKm = odo.valueKm
			}
		}

		let lastServiceDate: string | undefined
		if (lastDate.trim()) {
			const iso = fromDateInput(lastDate)
			if (!iso) {
				nextErrors.lastDate = 'Формат: ГГГГ-ММ-ДД'
			} else {
				lastServiceDate = iso
			}
		}

		let intervalKmValue: number | undefined
		if (intervalKm.trim()) {
			const parsed = parseOdometerKm(intervalKm)
			if (!parsed.ok || parsed.valueKm <= 0) {
				nextErrors.intervalKm = 'Целое число км > 0'
			} else {
				intervalKmValue = parsed.valueKm
			}
		}

		let intervalDaysValue: number | undefined
		if (intervalDays.trim()) {
			const parsed = parseUserDecimalNumber(intervalDays, { allowZero: false })
			if (!parsed.ok || !Number.isInteger(parsed.value)) {
				nextErrors.intervalDays = 'Целое число дней > 0'
			} else {
				intervalDaysValue = parsed.value
			}
		}

		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors)
			return null
		}
		setErrors({})

		return {
			id: editingId ?? createId(),
			vehicleId: activeVehicle.id,
			title: trimmedTitle,
			lastServiceDate,
			lastServiceOdometerKm,
			intervalKm: intervalKmValue,
			intervalDays: intervalDaysValue,
			note: note.trim() || undefined,
			active,
			remind,
			createdAt: createdAt ?? now,
			updatedAt: now,
		}
	}

	async function handleSave() {
		const now = new Date().toISOString()
		let item = buildItem(now)
		if (!item) {
			return
		}

		// Request permission only when the user turns reminders on.
		if (item.remind) {
			const allowed = await ensureNotificationPermission()
			if (!allowed) {
				Alert.alert(
					'Уведомления',
					'Без разрешения напоминания не будут доставлены. Запись всё равно можно сохранить.',
				)
				item = { ...item, remind: false }
				setRemind(false)
			}
		}

		setSaving(true)
		try {
			await upsertMaintenance(item)
			await syncMaintenanceReminders(item)
			if (!editingId) {
				getAnalyticsService().track('maintenance_created')
			}
			if (item.remind) {
				getAnalyticsService().track('maintenance_reminder_enabled')
			}
			await refresh()
			router.back()
		} catch (err) {
			console.warn('[maintenance] save failed', err)
			Alert.alert('Ошибка', 'Не удалось сохранить. Попробуйте ещё раз.')
		} finally {
			setSaving(false)
		}
	}

	async function handleComplete() {
		if (!editingId || !activeVehicle) {
			return
		}
		const existing = await getMaintenanceById(editingId)
		if (!existing) {
			return
		}
		const now = new Date().toISOString()
		const odo = parseOdometerKm(
			lastOdo.trim() || String(activeVehicle.currentOdometerKm),
		)
		if (!odo.ok) {
			setErrors({ lastOdo: describeDomainError(odo.code) })
			return
		}
		const completed = completeMaintenance(existing, {
			dateIso: now,
			odometerKm: odo.valueKm,
			nowIso: now,
		})
		try {
			await upsertMaintenance(completed)
			await syncMaintenanceReminders(completed)
			getAnalyticsService().track('maintenance_completed')
			await refresh()
			router.back()
		} catch (err) {
			console.warn('[maintenance] complete failed', err)
			Alert.alert('Ошибка', 'Не удалось отметить ТО. Попробуйте ещё раз.')
		}
	}

	function handleDelete() {
		if (!editingId) {
			return
		}
		Alert.alert('Удалить запись ТО?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						try {
							await cancelMaintenanceReminders(editingId)
							await deleteMaintenance(editingId)
							await refresh()
							router.back()
						} catch (err) {
							console.warn('[maintenance] delete failed', err)
							Alert.alert(
								'Ошибка',
								'Не удалось удалить запись ТО. Попробуйте ещё раз.',
							)
						}
					})()
				},
			},
		])
	}

	return (
		<Screen>
			<ScrollView
				style={styles.scroller}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: spacing.xl }}
			>
				<Text style={styles.title}>
					{editingId ? 'Редактирование ТО' : 'Новое ТО'}
				</Text>

				<Field
					label="Название *"
					value={title}
					onChangeText={setTitle}
					placeholder="Масло двигателя"
					error={errors.title}
				/>
				<Text style={styles.label}>Быстрый выбор</Text>
				<View style={styles.chips}>
					{MAINTENANCE_SUGGESTIONS.map((suggestion) => (
						<Chip
							key={suggestion}
							label={suggestion}
							selected={title === suggestion}
							onPress={() => setTitle(suggestion)}
						/>
					))}
				</View>

				<Field
					label="Последнее ТО — дата"
					value={lastDate}
					onChangeText={setLastDate}
					placeholder="2026-08-01"
					error={errors.lastDate}
				/>
				<Field
					label="Последнее ТО — пробег, км"
					value={lastOdo}
					onChangeText={setLastOdo}
					keyboardType="number-pad"
					error={errors.lastOdo}
				/>
				<Field
					label="Интервал, км"
					value={intervalKm}
					onChangeText={setIntervalKm}
					keyboardType="number-pad"
					placeholder="10000"
					error={errors.intervalKm}
				/>
				<Field
					label="Интервал, дни"
					value={intervalDays}
					onChangeText={setIntervalDays}
					keyboardType="number-pad"
					placeholder="365"
					error={errors.intervalDays}
				/>
				<Field label="Заметка" value={note} onChangeText={setNote} />

				<View style={styles.switchRow}>
					<Text style={styles.switchLabel}>Активно</Text>
					<Switch
						value={active}
						onValueChange={setActive}
						trackColor={{ true: colors.accent }}
					/>
				</View>

				<View style={styles.switchRow}>
					<View style={{ flex: 1 }}>
						<Text style={styles.switchLabel}>Напомнить</Text>
						<Text style={styles.hint}>
							Локально за 7 дней и в день следующего ТО по дате
						</Text>
					</View>
					<Switch
						value={remind}
						onValueChange={setRemind}
						trackColor={{ true: colors.accent }}
					/>
				</View>

				<PrimaryButton
					label={saving ? 'Сохранение…' : 'Сохранить'}
					onPress={() => {
						void handleSave()
					}}
					disabled={saving}
				/>
				{editingId ? (
					<>
						<SecondaryButton
							label="Отметить выполненным"
							onPress={() => {
								void handleComplete()
							}}
						/>
						<SecondaryButton label="Удалить" onPress={handleDelete} />
					</>
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
	scroller: {
		flex: 1,
	},
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
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: spacing.md,
	},
	switchLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
	hint: {
		marginTop: 2,
		fontSize: 12,
		color: colors.textMuted,
		paddingRight: spacing.sm,
	},
	muted: {
		color: colors.textMuted,
	},
})
