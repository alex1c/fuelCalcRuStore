import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
	calculateCostPerKm,
} from '@/domain/expenses'
import { calculateConsumption } from '@/domain/fuel'
import { kopecksToMajor } from '@/domain/shared/money'
import {
	estimateTripFuel,
	estimateTripOwnershipCost,
} from '@/domain/trip'
import { parseUserDecimalNumber } from '@/units'
import { getAnalyticsService } from '@/services/analytics'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { Field, Screen } from '@/ui/components'
import { formatMoneyKopecks } from '@/ui/format'

/**
 * Trip cost calculator — fuel-only estimate + optional ownership ₽/км estimate.
 */
export function TripCalculatorScreen() {
	const { activeVehicle, activeFuelEntries, activeExpenses } = useJournal()

	const defaults = useMemo(() => {
		let consumption = ''
		let price = ''

		if (activeVehicle) {
			const c = calculateConsumption(activeFuelEntries, activeVehicle.id)
			if (c.status === 'ok') {
				// Keep autofill readable (avoid long float strings in the field).
				consumption = c.averageLitersPer100Km
					.toFixed(2)
					.replace(/\.?0+$/, '')
					.replace('.', ',')
			}

			const sorted = [...activeFuelEntries].sort((a, b) =>
				a.recordedAt < b.recordedAt ? 1 : -1,
			)
			if (sorted[0]) {
				price = kopecksToMajor(sorted[0].pricePerLiterKopecks)
					.toFixed(2)
					.replace(/\.?0+$/, '')
					.replace('.', ',')
			}
		}

		return { consumption, price }
	}, [activeVehicle, activeFuelEntries])

	const [distance, setDistance] = useState('')
	const [consumption, setConsumption] = useState(defaults.consumption)
	const [price, setPrice] = useState(defaults.price)

	useFocusEffect(
		useCallback(() => {
			getAnalyticsService().track('trip_calculator_opened')
			getAnalyticsService().screen('trip_calculator')
			setConsumption(defaults.consumption)
			setPrice(defaults.price)
		}, [defaults.consumption, defaults.price]),
	)

	const distanceParsed = parseUserDecimalNumber(distance)
	const consumptionParsed = parseUserDecimalNumber(consumption)
	const priceParsed = parseUserDecimalNumber(price)

	const fuelEstimate =
		distanceParsed.ok && consumptionParsed.ok && priceParsed.ok
			? estimateTripFuel({
					distanceKm: distanceParsed.value,
					fuelConsumption: consumptionParsed.value,
					fuelPrice: priceParsed.value,
				})
			: null

	const ownership =
		activeVehicle && distanceParsed.ok
			? calculateCostPerKm(
					activeFuelEntries,
					activeExpenses,
					activeVehicle.id,
				)
			: null

	const ownershipEstimate =
		distanceParsed.ok &&
		ownership?.status === 'ok' &&
		ownership.costPerKmMajor !== undefined
			? estimateTripOwnershipCost({
					distanceKm: distanceParsed.value,
					costPerKmMajor: ownership.costPerKmMajor,
				})
			: null

	return (
		<Screen>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: spacing.xl }}
			>
				<Text style={styles.title}>Калькулятор поездки</Text>
				<Text style={styles.hint}>
					Оцените топливо и стоимость поездки. Значения можно изменить.
				</Text>

				<Field
					label="Расстояние, км"
					value={distance}
					onChangeText={setDistance}
					keyboardType="decimal-pad"
					placeholder="350"
				/>
				<Field
					label="Расход, л/100 км"
					value={consumption}
					onChangeText={setConsumption}
					keyboardType="decimal-pad"
					placeholder="8,3"
				/>
				<Field
					label="Цена топлива, ₽/л"
					value={price}
					onChangeText={setPrice}
					keyboardType="decimal-pad"
					placeholder="56,49"
				/>

				{fuelEstimate?.ok ? (
					<View style={styles.resultCard}>
						<Text style={styles.resultLabel}>Понадобится топлива</Text>
						<Text style={styles.resultHero}>
							{formatLitersRu(fuelEstimate.value.estimatedLiters)} л
						</Text>
						<Text style={styles.resultLabel}>Стоимость топлива</Text>
						<Text style={styles.resultValue}>
							{formatMoneyKopecks(fuelEstimate.value.estimatedFuelCostKopecks)}
						</Text>
					</View>
				) : (
					<Text style={styles.muted}>
						Введите расстояние, расход и цену топлива.
					</Text>
				)}

				{ownershipEstimate?.ok ? (
					<View style={styles.ownershipCard}>
						<Text style={styles.resultLabel}>
							Оценочная реальная стоимость поездки
						</Text>
						<Text style={styles.resultValue}>
							{formatMoneyKopecks(
								ownershipEstimate.value.estimatedOwnershipCostKopecks,
							)}
						</Text>
						<Text style={styles.note}>
							Учитывает среднюю стоимость эксплуатации автомобиля на километр.
						</Text>
					</View>
				) : null}
			</ScrollView>
		</Screen>
	)
}

function formatLitersRu(value: number): string {
	return value.toFixed(1).replace('.', ',')
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.sm,
	},
	hint: {
		fontSize: 14,
		color: colors.textSecondary,
		marginBottom: spacing.lg,
	},
	resultCard: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		marginTop: spacing.md,
	},
	ownershipCard: {
		backgroundColor: colors.chip,
		borderRadius: 12,
		padding: spacing.md,
		marginTop: spacing.md,
	},
	resultLabel: {
		fontSize: 13,
		color: colors.textSecondary,
		marginBottom: 4,
	},
	resultHero: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	resultValue: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.sm,
	},
	note: {
		fontSize: 12,
		color: colors.textMuted,
	},
	muted: {
		marginTop: spacing.md,
		color: colors.textMuted,
	},
})
