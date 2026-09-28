import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { FuelType } from '@/domain/shared/types'
import type { Vehicle } from '@/domain/vehicle/types'
import { parseOdometerKm } from '@/units'
import {
	createId,
	deleteVehicle,
	getVehicleById,
	upsertVehicle,
} from '@/persistence'
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

const FUEL_TYPES: { value: FuelType; label: string }[] = [
	{ value: 'petrol92', label: 'АИ-92' },
	{ value: 'petrol95', label: 'АИ-95' },
	{ value: 'petrol98', label: 'АИ-98' },
	{ value: 'diesel', label: 'ДТ' },
	{ value: 'lpg', label: 'Газ' },
	{ value: 'electric', label: 'Электро' },
	{ value: 'other', label: 'Другое' },
]

/** Create / edit a vehicle record. */
export function VehicleEditScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const { refresh, selectVehicle } = useJournal()
	const editingId = typeof params.id === 'string' ? params.id : undefined

	const [displayName, setDisplayName] = useState('')
	const [make, setMake] = useState('')
	const [model, setModel] = useState('')
	const [fuelType, setFuelType] = useState<FuelType>('petrol95')
	const [odometer, setOdometer] = useState('0')
	const [createdAt, setCreatedAt] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [nameError, setNameError] = useState<string | undefined>()

	useEffect(() => {
		if (!editingId) {
			return
		}

		void (async () => {
			const vehicle = await getVehicleById(editingId)
			if (!vehicle) {
				return
			}
			setDisplayName(vehicle.displayName)
			setMake(vehicle.make ?? '')
			setModel(vehicle.model ?? '')
			setFuelType(vehicle.fuelType)
			setOdometer(String(vehicle.currentOdometerKm))
			setCreatedAt(vehicle.createdAt)
		})()
	}, [editingId])

	async function handleSave() {
		const trimmed = displayName.trim()
		if (!trimmed) {
			setNameError('Укажите название')
			return
		}
		setNameError(undefined)

		const odoParsed = parseOdometerKm(odometer)
		if (!odoParsed.ok) {
			Alert.alert('Пробег', describeDomainError(odoParsed.code, 'odometerKm'))
			return
		}
		const odometerKm = odoParsed.valueKm

		setSaving(true)
		try {
			const now = new Date().toISOString()
			const vehicle: Vehicle = {
				id: editingId ?? createId(),
				displayName: trimmed,
				make: make.trim() || undefined,
				model: model.trim() || undefined,
				fuelType,
				currentOdometerKm: odometerKm,
				createdAt: createdAt ?? now,
				updatedAt: now,
			}
			await upsertVehicle(vehicle)
			await selectVehicle(vehicle.id)
			if (!editingId) {
				getAnalyticsService().track('vehicle_created')
			}
			await refresh()
			router.back()
		} catch (err) {
			console.warn('[vehicle] save failed', err)
			Alert.alert('Ошибка', 'Не удалось сохранить. Попробуйте ещё раз.')
		} finally {
			setSaving(false)
		}
	}

	function handleDelete() {
		if (!editingId) {
			return
		}

		Alert.alert(
			'Удалить автомобиль?',
			'Заправки, расходы и записи ТО этого автомобиля также будут удалены.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Удалить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							try {
								await deleteVehicle(editingId)
								await refresh()
								router.back()
							} catch (err) {
								console.warn('[vehicle] delete failed', err)
								Alert.alert(
									'Ошибка',
									'Не удалось удалить автомобиль. Попробуйте ещё раз.',
								)
							}
						})()
					},
				},
			],
		)
	}

	return (
		<Screen>
			<ScrollView
				style={styles.scroller}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: spacing.xl }}
			>
				<Text style={styles.title}>
					{editingId ? 'Редактирование' : 'Новый автомобиль'}
				</Text>

				<Field
					label="Название *"
					value={displayName}
					onChangeText={setDisplayName}
					placeholder="Мой автомобиль"
					error={nameError}
				/>
				<Field
					label="Марка"
					value={make}
					onChangeText={setMake}
					placeholder="Toyota"
				/>
				<Field
					label="Модель"
					value={model}
					onChangeText={setModel}
					placeholder="Corolla"
				/>
				<Field
					label="Текущий пробег, км"
					value={odometer}
					onChangeText={setOdometer}
					keyboardType="number-pad"
					placeholder="50000"
				/>

				<Text style={styles.label}>Тип топлива</Text>
				<View style={styles.chips}>
					{FUEL_TYPES.map((item) => (
						<Chip
							key={item.value}
							label={item.label}
							selected={fuelType === item.value}
							onPress={() => setFuelType(item.value)}
						/>
					))}
				</View>

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
		marginBottom: spacing.lg,
	},
})
