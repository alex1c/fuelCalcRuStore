import { useEffect, useMemo, useState } from 'react'
import {
	Alert,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	resolveFuelMoney,
	validateFuelOdometer,
	type FuelMoneyInput,
} from '@/domain/fuel'
import type { FuelEntry } from '@/domain/fuel/types'
import { kopecksToMajor } from '@/domain/shared/money'
import { mlToLiters } from '@/domain/shared/volume'
import { parseOdometerKm, parseUserDecimalNumber } from '@/units'
import {
	createId,
	deleteFuelEntry,
	getFuelEntryById,
	listFuelEntries,
	upsertFuelEntry,
	upsertVehicle,
} from '@/persistence'
import { getAnalyticsService } from '@/services/analytics'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { Chip, Field, PrimaryButton, Screen, SecondaryButton } from '@/ui/components'
import { describeDomainError } from '@/ui/domain-errors'
import { formatMoneyKopecks } from '@/ui/format'

type MoneyMode = 'liters_and_price' | 'liters_and_total'

/**
 * Add / edit fuel entry.
 * Fast path: odometer + liters + price/total + full tank.
 */
export function FuelEntryScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const editingId = typeof params.id === 'string' ? params.id : undefined
	const { activeVehicle, refresh } = useJournal()

	const [recordedAtLocal, setRecordedAtLocal] = useState(toLocalInput(new Date()))
	const [odometer, setOdometer] = useState('')
	const [liters, setLiters] = useState('')
	const [price, setPrice] = useState('')
	const [total, setTotal] = useState('')
	const [mode, setMode] = useState<MoneyMode>('liters_and_price')
	const [fullTank, setFullTank] = useState(true)
	const [note, setNote] = useState('')
	const [createdAt, setCreatedAt] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [loaded, setLoaded] = useState(!editingId)

	useEffect(() => {
		if (!editingId) {
			if (activeVehicle) {
				setOdometer(String(activeVehicle.currentOdometerKm))
			}
			return
		}

		void (async () => {
			const entry = await getFuelEntryById(editingId)
			if (!entry) {
				setLoaded(true)
				return
			}
			setRecordedAtLocal(toLocalInput(new Date(entry.recordedAt)))
			setOdometer(String(entry.odometerKm))
			setLiters(String(mlToLiters(entry.litersMl)).replace('.', ','))
			setPrice(
				String(kopecksToMajor(entry.pricePerLiterKopecks)).replace('.', ','),
			)
			setTotal(String(kopecksToMajor(entry.totalCostKopecks)).replace('.', ','))
			setMode('liters_and_price')
			setFullTank(entry.fullTank)
			setNote(entry.note ?? '')
			setCreatedAt(entry.createdAt)
			setLoaded(true)
		})()
	}, [editingId, activeVehicle])

	const preview = useMemo(() => {
		const litersParsed = parseUserDecimalNumber(liters)
		if (!litersParsed.ok) {
			return null
		}

		let input: FuelMoneyInput
		if (mode === 'liters_and_price') {
			const priceParsed = parseUserDecimalNumber(price)
			if (!priceParsed.ok) {
				return null
			}
			input = {
				mode: 'liters_and_price',
				liters: litersParsed.value,
				pricePerLiter: priceParsed.value,
			}
		} else {
			const totalParsed = parseUserDecimalNumber(total)
			if (!totalParsed.ok) {
				return null
			}
			input = {
				mode: 'liters_and_total',
				liters: litersParsed.value,
				totalCost: totalParsed.value,
			}
		}

		const resolved = resolveFuelMoney(input)
		return resolved.ok ? resolved.value : null
	}, [liters, price, total, mode])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>Заправка</Text>
				<Text style={styles.muted}>Сначала добавьте автомобиль.</Text>
			</Screen>
		)
	}

	if (!loaded) {
		return (
			<Screen>
				<Text style={styles.muted}>Загрузка…</Text>
			</Screen>
		)
	}

	async function handleSave() {
		if (!activeVehicle) {
			return
		}

		const errors: Record<string, string> = {}
		const odoParsed = parseOdometerKm(odometer)
		if (!odoParsed.ok) {
			errors.odometer = describeDomainError(odoParsed.code, 'odometerKm')
		}

		const recordedAt = fromLocalInput(recordedAtLocal)
		if (!recordedAt) {
			errors.recordedAt = 'Укажите дату и время (ГГГГ-ММ-ДД ЧЧ:ММ)'
		}

		const litersParsed = parseUserDecimalNumber(liters)
		if (!litersParsed.ok) {
			errors.liters = describeDomainError(litersParsed.code, 'liters')
		}

		let moneyInput: FuelMoneyInput | null = null
		if (mode === 'liters_and_price') {
			const priceParsed = parseUserDecimalNumber(price)
			if (!priceParsed.ok) {
				errors.price = describeDomainError(priceParsed.code, 'pricePerLiter')
			} else if (litersParsed.ok) {
				moneyInput = {
					mode: 'liters_and_price',
					liters: litersParsed.value,
					pricePerLiter: priceParsed.value,
				}
			}
		} else {
			const totalParsed = parseUserDecimalNumber(total)
			if (!totalParsed.ok) {
				errors.total = describeDomainError(totalParsed.code, 'totalCost')
			} else if (litersParsed.ok) {
				moneyInput = {
					mode: 'liters_and_total',
					liters: litersParsed.value,
					totalCost: totalParsed.value,
				}
			}
		}

		if (Object.keys(errors).length > 0 || !moneyInput || !odoParsed.ok || !recordedAt) {
			setFieldErrors(errors)
			return
		}

		const money = resolveFuelMoney(moneyInput)
		if (!money.ok) {
			const first = money.errors[0]
			setFieldErrors({
				[first.field ?? 'liters']: describeDomainError(first.code, first.field),
			})
			return
		}

		const entryId = editingId ?? createId()
		const existing = await listFuelEntries(activeVehicle.id)
		const odoCheck = validateFuelOdometer(existing, {
			id: entryId,
			vehicleId: activeVehicle.id,
			odometerKm: odoParsed.valueKm,
			recordedAt,
		})

		if (!odoCheck.ok) {
			const first = odoCheck.errors[0]
			setFieldErrors({
				odometer: describeDomainError(first.code, first.field),
			})
			return
		}

		setFieldErrors({})
		setSaving(true)

		try {
			const now = new Date().toISOString()
			const entry: FuelEntry = {
				id: entryId,
				vehicleId: activeVehicle.id,
				recordedAt,
				odometerKm: odoParsed.valueKm,
				litersMl: money.value.litersMl,
				totalCostKopecks: money.value.totalCostKopecks,
				pricePerLiterKopecks: money.value.pricePerLiterKopecks,
				fullTank,
				note: note.trim() || undefined,
				createdAt: createdAt ?? now,
				updatedAt: now,
			}

			await upsertFuelEntry(entry)

			if (odoParsed.valueKm > activeVehicle.currentOdometerKm) {
				await upsertVehicle({
					...activeVehicle,
					currentOdometerKm: odoParsed.valueKm,
					updatedAt: now,
				})
			}

			const tank = fullTank ? 'full' : 'partial'
			const money_mode =
				mode === 'liters_and_price' ? 'liters_price' : 'liters_total'
			if (editingId) {
				getAnalyticsService().track('fuel_entry_edited', { tank, money_mode })
			} else {
				getAnalyticsService().track('fuel_entry_created', { tank, money_mode })
			}

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
		Alert.alert('Удалить заправку?', 'Расход и статистика пересчитаются.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await deleteFuelEntry(editingId)
						getAnalyticsService().track('fuel_entry_deleted')
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
					{editingId ? 'Редактирование заправки' : 'Новая заправка'}
				</Text>
				<Text style={styles.vehicle}>{activeVehicle.displayName}</Text>

				<Field
					label="Пробег, км *"
					value={odometer}
					onChangeText={setOdometer}
					keyboardType="number-pad"
					error={fieldErrors.odometer}
				/>
				<Field
					label="Литры *"
					value={liters}
					onChangeText={setLiters}
					keyboardType="decimal-pad"
					placeholder="40,5"
					error={fieldErrors.liters}
				/>

				<Text style={styles.label}>Стоимость</Text>
				<View style={styles.chips}>
					<Chip
						label="Цена за литр"
						selected={mode === 'liters_and_price'}
						onPress={() => setMode('liters_and_price')}
					/>
					<Chip
						label="Сумма"
						selected={mode === 'liters_and_total'}
						onPress={() => setMode('liters_and_total')}
					/>
				</View>

				{mode === 'liters_and_price' ? (
					<Field
						label="Цена за литр, ₽ *"
						value={price}
						onChangeText={setPrice}
						keyboardType="decimal-pad"
						placeholder="56,49"
						error={fieldErrors.price}
					/>
				) : (
					<Field
						label="Сумма, ₽ *"
						value={total}
						onChangeText={setTotal}
						keyboardType="decimal-pad"
						placeholder="2259,60"
						error={fieldErrors.total}
					/>
				)}

				{preview ? (
					<View style={styles.preview}>
						<Text style={styles.previewText}>
							{mlToLiters(preview.litersMl).toFixed(3)} л ·{' '}
							{kopecksToMajor(preview.pricePerLiterKopecks).toFixed(2)} ₽/л ·{' '}
							{formatMoneyKopecks(preview.totalCostKopecks)}
						</Text>
					</View>
				) : null}

				<View style={styles.switchRow}>
					<View style={{ flex: 1, paddingRight: spacing.md }}>
						<Text style={styles.switchLabel}>Полный бак</Text>
						<Text style={styles.switchHint}>
							{fullTank
								? 'Полная заправка — для расчёта расхода'
								: 'Частичная заправка — расход не обновляется'}
						</Text>
					</View>
					<Switch
						value={fullTank}
						onValueChange={setFullTank}
						trackColor={{ true: colors.accent }}
					/>
				</View>

				<Field
					label="Дата и время (ГГГГ-ММ-ДД ЧЧ:ММ)"
					value={recordedAtLocal}
					onChangeText={setRecordedAtLocal}
					placeholder="2026-08-26 14:30"
					error={fieldErrors.recordedAt}
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

function toLocalInput(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(raw: string): string | null {
	const trimmed = raw.trim()
	const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(trimmed)
	if (!match) {
		return null
	}
	const [, y, m, d, hh, mm] = match
	const date = new Date(
		Number(y),
		Number(m) - 1,
		Number(d),
		Number(hh),
		Number(mm),
		0,
		0,
	)
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
		marginBottom: 4,
	},
	vehicle: {
		fontSize: 14,
		color: colors.textSecondary,
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
		marginBottom: spacing.sm,
	},
	preview: {
		backgroundColor: colors.chip,
		borderRadius: 10,
		padding: spacing.sm,
		marginBottom: spacing.md,
	},
	previewText: {
		color: colors.textPrimary,
		fontSize: 14,
		fontWeight: '600',
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: spacing.md,
		paddingVertical: 4,
	},
	switchLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
	switchHint: {
		marginTop: 2,
		fontSize: 12,
		color: colors.textMuted,
	},
	muted: {
		color: colors.textMuted,
	},
})
