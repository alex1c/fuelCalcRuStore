import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
	aggregateCosts,
	calculateCostPerKm,
	monthPeriod,
	yearPeriod,
} from '@/domain/expenses'
import { calculateConsumption } from '@/domain/fuel'
import { mlToLiters } from '@/domain/shared/volume'
import { getAdService } from '@/services/ads'
import { JournalBanner } from '@/services/ads/journal-banner'
import { getAnalyticsService } from '@/services/analytics'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { Screen } from '@/ui/components'
import { formatConsumption, formatMoneyKopecks } from '@/ui/format'
import { expenseCategoryLabel } from '@/ui/labels'

/** Lightweight statistics — numbers first, optional simple bars + rare interstitial. */
export function StatsScreen() {
	const { activeVehicle, activeFuelEntries, activeExpenses } = useJournal()
	const now = new Date()

	useEffect(() => {
		getAnalyticsService().track('statistics_opened')
		getAnalyticsService().screen('statistics')
		// Secondary feature only — never from save flows. Policy may skip.
		void getAdService().showInterstitial('stats_open')
	}, [])

	const consumption = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return calculateConsumption(activeFuelEntries, activeVehicle.id)
	}, [activeVehicle, activeFuelEntries])

	const lifetime = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return aggregateCosts(activeFuelEntries, activeExpenses, activeVehicle.id)
	}, [activeVehicle, activeFuelEntries, activeExpenses])

	const thisMonth = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return aggregateCosts(
			activeFuelEntries,
			activeExpenses,
			activeVehicle.id,
			monthPeriod(now.getFullYear(), now.getMonth() + 1),
		)
	}, [activeVehicle, activeFuelEntries, activeExpenses, now])

	const thisYear = useMemo(() => {
		if (!activeVehicle) {
			return null
		}
		return aggregateCosts(
			activeFuelEntries,
			activeExpenses,
			activeVehicle.id,
			yearPeriod(now.getFullYear()),
		)
	}, [activeVehicle, activeFuelEntries, activeExpenses, now])

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

	const monthlyBars = useMemo(() => {
		if (!activeVehicle) {
			return []
		}
		const bars: { label: string; value: number }[] = []
		for (let i = 5; i >= 0; i -= 1) {
			const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
			const period = monthPeriod(date.getFullYear(), date.getMonth() + 1)
			const total = aggregateCosts(
				activeFuelEntries,
				activeExpenses,
				activeVehicle.id,
				period,
			).totalKopecks
			bars.push({
				label: date.toLocaleDateString('ru-RU', { month: 'short' }),
				value: total,
			})
		}
		return bars
	}, [activeVehicle, activeFuelEntries, activeExpenses, now])

	const consumptionBars = useMemo(() => {
		if (consumption?.status !== 'ok') {
			return []
		}
		return consumption.intervals.slice(-6).map((interval, index) => ({
			label: String(index + 1),
			value: interval.litersPer100Km,
		}))
	}, [consumption])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>Статистика</Text>
				<Text style={styles.muted}>Добавьте автомобиль</Text>
			</Screen>
		)
	}

	const totalLitersMl = activeFuelEntries.reduce(
		(sum, entry) => sum + entry.litersMl,
		0,
	)

	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
				<Text style={styles.title}>Статистика</Text>

				{/* Primary summary metrics first — banner sits after them. */}
				<Section title="Топливо">
					<Line
						label="Средний расход"
						value={
							consumption?.status === 'ok'
								? formatConsumption(consumption.averageLitersPer100Km)
								: 'недостаточно данных'
						}
					/>
					<Line
						label="Всего литров"
						value={`${mlToLiters(totalLitersMl).toFixed(1)} л`}
					/>
					<Line
						label="Затраты на топливо"
						value={
							lifetime ? formatMoneyKopecks(lifetime.fuelKopecks) : '—'
						}
					/>
				</Section>

				<Section title="Расходы">
					<Line
						label="Текущий месяц"
						value={
							thisMonth
								? formatMoneyKopecks(thisMonth.totalKopecks)
								: '—'
						}
					/>
					<Line
						label="Текущий год"
						value={thisYear ? formatMoneyKopecks(thisYear.totalKopecks) : '—'}
					/>
					{lifetime
						? Object.entries(lifetime.byCategory)
								.filter(([, v]) => v > 0)
								.map(([category, value]) => (
									<Line
										key={category}
										label={expenseCategoryLabel(category as never)}
										value={formatMoneyKopecks(value)}
									/>
								))
						: null}
				</Section>

				<Section title="Владение">
					<Line
						label="₽/км"
						value={
							costPerKm?.status === 'ok' && costPerKm.costPerKmMajor !== undefined
								? `${costPerKm.costPerKmMajor.toFixed(2)} ₽/км`
								: 'Стоимость километра пока недоступна'
						}
					/>
					{thisYear && thisYear.totalKopecks > 0 ? (
						<Line
							label="В среднем за месяц (год)"
							value={formatMoneyKopecks(
								Math.round(thisYear.totalKopecks / (now.getMonth() + 1)),
							)}
						/>
					) : null}
				</Section>

				{/* Banner after headline metrics, before secondary charts. */}
				{activeVehicle ? (
					<JournalBanner
						visible
						placement="stats_banner"
						remountKey={activeVehicle.id}
					/>
				) : null}

				<Section title="Динамика">
					{monthlyBars.some((b) => b.value > 0) ? (
						<>
							<Text style={styles.chartTitle}>Расходы по месяцам</Text>
							<SimpleBars
								data={monthlyBars}
								formatValue={(v) => formatMoneyKopecks(v)}
							/>
						</>
					) : (
						<Text style={styles.muted}>Пока нет расходов для графика</Text>
					)}
					{consumptionBars.length > 0 ? (
						<>
							<Text style={styles.chartTitle}>Динамика расхода</Text>
							<SimpleBars
								data={consumptionBars}
								formatValue={(v) => v.toFixed(1)}
							/>
						</>
					) : null}
				</Section>
			</ScrollView>
		</Screen>
	)
}

function Section({
	title,
	children,
}: {
	title: string
	children: ReactNode
}) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			{children}
		</View>
	)
}

function Line({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.line}>
			<Text style={styles.lineLabel}>{label}</Text>
			<Text style={styles.lineValue}>{value}</Text>
		</View>
	)
}

function SimpleBars({
	data,
	formatValue,
}: {
	data: { label: string; value: number }[]
	formatValue: (value: number) => string
}) {
	const max = Math.max(...data.map((item) => item.value), 1)
	return (
		<View style={styles.chart}>
			{data.map((item) => (
				<View key={item.label} style={styles.barRow}>
					<Text style={styles.barLabel}>{item.label}</Text>
					<View style={styles.barTrack}>
						<View
							style={[
								styles.barFill,
								{ width: `${Math.max(4, (item.value / max) * 100)}%` },
							]}
						/>
					</View>
					<Text style={styles.barValue}>{formatValue(item.value)}</Text>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	section: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		marginBottom: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.sm,
	},
	line: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: spacing.sm,
		marginBottom: 6,
	},
	lineLabel: {
		flex: 1,
		fontSize: 14,
		color: colors.textSecondary,
	},
	lineValue: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.textPrimary,
		textAlign: 'right',
		flexShrink: 1,
	},
	chartTitle: {
		marginTop: spacing.md,
		marginBottom: spacing.sm,
		fontSize: 13,
		fontWeight: '600',
		color: colors.textSecondary,
	},
	chart: {
		gap: 8,
	},
	barRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	barLabel: {
		width: 36,
		fontSize: 12,
		color: colors.textMuted,
	},
	barTrack: {
		flex: 1,
		height: 10,
		borderRadius: 999,
		backgroundColor: colors.chip,
		overflow: 'hidden',
	},
	barFill: {
		height: '100%',
		backgroundColor: colors.accent,
		borderRadius: 999,
	},
	barValue: {
		width: 72,
		fontSize: 11,
		color: colors.textSecondary,
		textAlign: 'right',
	},
	muted: {
		color: colors.textMuted,
	},
})
