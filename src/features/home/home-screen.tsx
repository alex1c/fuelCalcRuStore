import { useMemo } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
	aggregateCosts,
	calculateCostPerKm,
	monthPeriod,
	yearPeriod,
} from '@/domain/expenses'
import { calculateConsumption } from '@/domain/fuel'
import { getMaintenanceDueStatus } from '@/domain/maintenance'
import { JournalBanner } from '@/services/ads/journal-banner'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { PrimaryButton, Screen, SecondaryButton } from '@/ui/components'
import { formatConsumption, formatMoneyKopecks } from '@/ui/format'
import { expenseCategoryLabel } from '@/ui/labels'

/** Home dashboard — hero consumption, then cost/TO, then quick actions, then banner. */
export function HomeScreen() {
	const router = useRouter()
	const {
		isReady,
		error,
		activeVehicle,
		vehicles,
		activeFuelEntries,
		activeExpenses,
		activeMaintenance,
	} = useJournal()

	// Stable calendar snapshot for the screen mount (avoid Date in memo deps).
	const clock = useMemo(() => {
		const date = new Date()
		return {
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			iso: date.toISOString(),
			date,
		}
	}, [])
	const month = useMemo(
		() => monthPeriod(clock.year, clock.month),
		[clock.year, clock.month],
	)
	const year = useMemo(() => yearPeriod(clock.year), [clock.year])

	const consumption = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return calculateConsumption(activeFuelEntries, activeVehicle.id)
	}, [activeVehicle, activeFuelEntries])

	const monthCosts = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return aggregateCosts(
			activeFuelEntries,
			activeExpenses,
			activeVehicle.id,
			month,
		)
	}, [activeVehicle, activeFuelEntries, activeExpenses, month])

	const costPerKm = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return calculateCostPerKm(
			activeFuelEntries,
			activeExpenses,
			activeVehicle.id,
		)
	}, [activeVehicle, activeFuelEntries, activeExpenses])

	const nearestMaintenance = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		const nowIso = clock.iso
		const ranked = activeMaintenance
			.map((item) => ({
				item,
				status: getMaintenanceDueStatus(item, {
					dateIso: nowIso,
					odometerKm: activeVehicle.currentOdometerKm,
				}),
			}))
			.filter((row) => row.status.hasSchedule)

		ranked.sort((a, b) => {
			const aKm = a.status.remainingKm ?? Number.POSITIVE_INFINITY
			const bKm = b.status.remainingKm ?? Number.POSITIVE_INFINITY
			const aDays = a.status.remainingDays ?? Number.POSITIVE_INFINITY
			const bDays = b.status.remainingDays ?? Number.POSITIVE_INFINITY
			return Math.min(aKm, aDays * 30) - Math.min(bKm, bDays * 30)
		})
		return ranked[0] ?? null
	}, [activeMaintenance, activeVehicle, clock.iso])

	const recent = useMemo(() => {
		const fuel = activeFuelEntries.map((e) => ({
			id: e.id,
			at: e.recordedAt,
			label: `Заправка · ${formatMoneyKopecks(e.totalCostKopecks)}`,
			kind: 'fuel' as const,
		}))
		const expenses = activeExpenses.map((e) => ({
			id: e.id,
			at: e.recordedAt,
			label: `${expenseCategoryLabel(e.category)} · ${formatMoneyKopecks(e.amountKopecks)}`,
			kind: 'expense' as const,
		}))
		return [...fuel, ...expenses]
			.sort((a, b) => (a.at < b.at ? 1 : -1))
			.slice(0, 5)
	}, [activeFuelEntries, activeExpenses])

	if (!isReady) {
		return (
			<Screen>
				<Text style={styles.muted}>Загрузка…</Text>
			</Screen>
		)
	}

	if (error) {
		return (
			<Screen>
				<Text style={styles.error}>Ошибка БД: {error}</Text>
			</Screen>
		)
	}

	if (vehicles.length === 0 || !activeVehicle) {
		return (
			<Screen>
				<ScrollView>
					<Text style={styles.brand}>Автожурнал</Text>
					<Text style={styles.subtitle}>
						Добавьте автомобиль, чтобы вести заправки и расходы.
					</Text>
					<PrimaryButton
						label="Добавить автомобиль"
						onPress={() => router.push('/vehicles/edit')}
					/>
				</ScrollView>
			</Screen>
		)
	}

	const averageText =
		consumption?.status === 'ok'
			? formatConsumption(consumption.averageLitersPer100Km)
			: null

	const lastInterval =
		consumption?.status === 'ok'
			? consumption.intervals[consumption.intervals.length - 1]
			: null

	const costPerKmText =
		costPerKm?.status === 'ok' && costPerKm.costPerKmMajor !== undefined
			? `${costPerKm.costPerKmMajor.toFixed(2).replace('.', ',')} ₽/км`
			: null

	const monthSpendText = monthCosts
		? `${formatMoneyKopecks(monthCosts.totalKopecks)} в ${monthName(clock.date)}`
		: null

	const toText = formatNearestMaintenance(nearestMaintenance)

	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
				<Pressable onPress={() => router.push('/vehicles')}>
					<Text style={styles.vehicleLabel}>Автомобиль</Text>
					<Text style={styles.vehicleName}>{activeVehicle.displayName}</Text>
				</Pressable>

				<Pressable
					onPress={
						lastInterval
							? () =>
									Alert.alert(
										'Расход',
										lastInterval.explanation.formula +
											(consumption?.status === 'ok'
												? `\n\nСредний: ${formatConsumption(consumption.averageLitersPer100Km)}`
												: ''),
									)
							: undefined
					}
					style={styles.hero}
				>
					<Text style={styles.heroValue}>
						{averageText ?? '—'}
					</Text>
					<Text style={styles.heroLabel}>Средний расход</Text>
				</Pressable>

				{consumption?.status === 'insufficient_data' ? (
					<Text style={styles.hint}>
						{describeFuelEmpty(consumption.reason)}
					</Text>
				) : null}

				<View style={styles.secondaryRow}>
					{costPerKmText ? (
						<Text style={styles.secondaryMetric}>{costPerKmText}</Text>
					) : (
						<Text style={styles.secondaryMuted}>₽/км пока недоступна</Text>
					)}
					{monthSpendText ? (
						<Text style={styles.secondaryMetric}>{monthSpendText}</Text>
					) : null}
					{toText ? (
						<Text style={styles.secondaryMetric}>{toText}</Text>
					) : (
						<Text style={styles.secondaryMuted}>ТО не запланировано</Text>
					)}
				</View>

				<View style={styles.actions}>
					<PrimaryButton
						label="+ Заправка"
						onPress={() => router.push('/fuel/new')}
					/>
					<View style={{ height: spacing.sm }} />
					<SecondaryButton
						label="+ Расход"
						onPress={() => router.push('/expenses/edit')}
					/>
					<SecondaryButton
						label="+ ТО"
						onPress={() => router.push('/maintenance/edit')}
					/>
				</View>

				{/* Banner below useful content and CTAs — never between metric and +Заправка. */}
				<JournalBanner
					visible
					placement="home_banner"
					remountKey={activeVehicle.id}
				/>

				<Text style={styles.section}>Последние записи</Text>
				{recent.length === 0 ? (
					<Text style={styles.muted}>Добавьте первую заправку</Text>
				) : (
					recent.map((item) => (
						<Pressable
							key={`${item.kind}-${item.id}`}
							style={styles.recentRow}
							onPress={() => {
								if (item.kind === 'fuel') {
									router.push({
										pathname: '/fuel/edit',
										params: { id: item.id },
									})
								} else {
									router.push({
										pathname: '/expenses/edit',
										params: { id: item.id },
									})
								}
							}}
						>
							<Text style={styles.recentText}>{item.label}</Text>
						</Pressable>
					))
				)}

				{monthCosts && monthCosts.totalKopecks > 0 ? (
					<View style={styles.breakdown}>
						<Text style={styles.section}>Структура месяца</Text>
						{Object.entries(monthCosts.byCategory)
							.filter(([, value]) => value > 0)
							.map(([category, value]) => (
								<Text key={category} style={styles.breakdownLine}>
									{expenseCategoryLabel(category as never)}:{' '}
									{formatMoneyKopecks(value)}
								</Text>
							))}
						<Text style={styles.muted}>
							Год:{' '}
							{formatMoneyKopecks(
								aggregateCosts(
									activeFuelEntries,
									activeExpenses,
									activeVehicle.id,
									year,
								).totalKopecks,
							)}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</Screen>
	)
}

function formatNearestMaintenance(
	nearest: {
		item: { title: string }
		status: {
			urgency: string
			remainingKm?: number
			remainingDays?: number
		}
	} | null,
): string | null {
	if (!nearest) {
		return null
	}
	const title = nearest.item.title
	const { urgency, remainingKm, remainingDays } = nearest.status

	if (urgency === 'overdue') {
		if (remainingKm !== undefined) {
			return `${title}: просрочено на ${Math.abs(remainingKm).toLocaleString('ru-RU')} км`
		}
		if (remainingDays !== undefined) {
			return `${title}: просрочено на ${Math.abs(remainingDays)} дн.`
		}
	}

	if (remainingKm !== undefined) {
		return `${title}: через ${remainingKm.toLocaleString('ru-RU')} км`
	}
	if (remainingDays !== undefined) {
		return `${title}: через ${remainingDays} дн.`
	}
	return title
}

function describeFuelEmpty(reason: string): string {
	switch (reason) {
		case 'no_entries':
			return 'Добавьте первую заправку'
		case 'only_baseline_full_tank':
			return 'Начальная точка сохранена. Расход появится после следующей полной заправки.'
		case 'no_full_tank':
			return 'Отметьте «Полный бак», чтобы рассчитать расход'
		default:
			return 'Недостаточно данных для расхода'
	}
}

function monthName(date: Date): string {
	return date.toLocaleDateString('ru-RU', { month: 'long' })
}

const styles = StyleSheet.create({
	brand: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	vehicleLabel: {
		fontSize: 12,
		color: colors.textMuted,
	},
	vehicleName: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
		flexShrink: 1,
	},
	subtitle: {
		fontSize: 15,
		color: colors.textSecondary,
		marginBottom: spacing.lg,
	},
	hero: {
		marginBottom: spacing.sm,
	},
	heroValue: {
		fontSize: 36,
		fontWeight: '800',
		color: colors.textPrimary,
		letterSpacing: -0.5,
		flexShrink: 1,
	},
	heroLabel: {
		fontSize: 14,
		color: colors.textSecondary,
		marginTop: 2,
	},
	secondaryRow: {
		gap: 6,
		marginBottom: spacing.lg,
	},
	secondaryMetric: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.textPrimary,
		flexShrink: 1,
	},
	secondaryMuted: {
		fontSize: 14,
		color: colors.textMuted,
	},
	actions: {
		marginBottom: spacing.md,
	},
	section: {
		fontSize: 15,
		fontWeight: '700',
		color: colors.textPrimary,
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
	},
	recentRow: {
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	recentText: {
		fontSize: 14,
		color: colors.textPrimary,
	},
	breakdown: {
		marginTop: spacing.md,
	},
	breakdownLine: {
		fontSize: 14,
		color: colors.textSecondary,
		marginBottom: 4,
	},
	hint: {
		fontSize: 13,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	muted: {
		color: colors.textMuted,
	},
	error: {
		color: colors.error,
	},
})
