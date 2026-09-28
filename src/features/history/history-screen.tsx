import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { Chip, Screen } from '@/ui/components'
import {
	formatLiters,
	formatMoneyKopecks,
	formatOdometer,
} from '@/ui/format'
import { expenseCategoryLabel } from '@/ui/labels'

type HistoryFilter = 'all' | 'fuel' | 'expenses'

type TimelineItem =
	| {
			kind: 'fuel'
			id: string
			at: string
			title: string
			subtitle: string
	  }
	| {
			kind: 'expense'
			id: string
			at: string
			title: string
			subtitle: string
	  }

/** Combined history with fuel / expenses filters. */
export function HistoryScreen() {
	const router = useRouter()
	const { activeVehicle, activeFuelEntries, activeExpenses } = useJournal()
	const [filter, setFilter] = useState<HistoryFilter>('all')

	const items = useMemo(() => {
		const fuelItems: TimelineItem[] = activeFuelEntries.map((entry) => ({
			kind: 'fuel' as const,
			id: entry.id,
			at: entry.recordedAt,
			title: `Заправка · ${formatOdometer(entry.odometerKm)}`,
			subtitle: `${formatLiters(entry.litersMl)} л · ${formatMoneyKopecks(entry.totalCostKopecks)}${entry.fullTank ? ' · полный бак' : ' · частичная'}`,
		}))
		const expenseItems: TimelineItem[] = activeExpenses.map((expense) => ({
			kind: 'expense' as const,
			id: expense.id,
			at: expense.recordedAt,
			title: expenseCategoryLabel(expense.category),
			subtitle: `${formatMoneyKopecks(expense.amountKopecks)}${expense.note ? ` · ${expense.note}` : ''}`,
		}))

		const merged = [...fuelItems, ...expenseItems].sort((a, b) =>
			a.at < b.at ? 1 : -1,
		)

		if (filter === 'fuel') {
			return merged.filter((item) => item.kind === 'fuel')
		}
		if (filter === 'expenses') {
			return merged.filter((item) => item.kind === 'expense')
		}
		return merged
	}, [activeFuelEntries, activeExpenses, filter])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>История</Text>
				<Text style={styles.muted}>Добавьте автомобиль</Text>
			</Screen>
		)
	}

	return (
		<Screen>
			<Text style={styles.title}>История</Text>
			<View style={styles.chips}>
				<Chip label="Все" selected={filter === 'all'} onPress={() => setFilter('all')} />
				<Chip
					label="Заправки"
					selected={filter === 'fuel'}
					onPress={() => setFilter('fuel')}
				/>
				<Chip
					label="Расходы"
					selected={filter === 'expenses'}
					onPress={() => setFilter('expenses')}
				/>
			</View>

			<FlatList
				style={styles.list}
				data={items}
				keyExtractor={(item) => `${item.kind}-${item.id}`}
				ListEmptyComponent={
					<Text style={styles.muted}>Пока нет записей</Text>
				}
				renderItem={({ item }) => (
					<Pressable
						style={styles.row}
						onPress={() => {
							if (item.kind === 'fuel') {
								router.push({ pathname: '/fuel/edit', params: { id: item.id } })
							} else {
								router.push({
									pathname: '/expenses/edit',
									params: { id: item.id },
								})
							}
						}}
					>
						<Text style={styles.rowTitle}>{item.title}</Text>
						<Text style={styles.rowMeta}>{item.subtitle}</Text>
						<Text style={styles.rowDate}>
							{new Date(item.at).toLocaleString('ru-RU')}
						</Text>
					</Pressable>
				)}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	list: {
		flex: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: spacing.sm,
	},
	row: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		marginBottom: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
	},
	rowTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.textPrimary,
	},
	rowMeta: {
		marginTop: 4,
		fontSize: 14,
		color: colors.textSecondary,
	},
	rowDate: {
		marginTop: 4,
		fontSize: 12,
		color: colors.textMuted,
	},
	muted: {
		color: colors.textMuted,
	},
})
