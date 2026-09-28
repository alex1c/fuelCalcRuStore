import { useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
	getMaintenanceDueStatus,
	type MaintenanceUrgency,
} from '@/domain/maintenance'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { PrimaryButton, Screen } from '@/ui/components'
import { urgencyLabel } from '@/ui/labels'

/** Maintenance list with due status for the active vehicle. */
export function MaintenanceListScreen() {
	const router = useRouter()
	const { activeVehicle, activeMaintenance } = useJournal()
	const nowIso = new Date().toISOString()

	const rows = useMemo(() => {
		if (!activeVehicle) {
			return []
		}
		return activeMaintenance.map((item) => ({
			item,
			status: getMaintenanceDueStatus(item, {
				dateIso: nowIso,
				odometerKm: activeVehicle.currentOdometerKm,
			}),
		}))
	}, [activeMaintenance, activeVehicle, nowIso])

	if (!activeVehicle) {
		return (
			<Screen>
				<Text style={styles.title}>ТО</Text>
				<Text style={styles.muted}>Добавьте автомобиль</Text>
			</Screen>
		)
	}

	return (
		<Screen>
			<Text style={styles.title}>Обслуживание</Text>
			<FlatList
				style={styles.list}
				data={rows}
				keyExtractor={(row) => row.item.id}
				ListEmptyComponent={
					<Text style={styles.muted}>Пока нет записей ТО</Text>
				}
				renderItem={({ item: row }) => (
					<Pressable
						style={styles.row}
						onPress={() =>
							router.push({
								pathname: '/maintenance/edit',
								params: { id: row.item.id },
							})
						}
					>
						<View style={{ flex: 1 }}>
							<Text style={styles.name}>{row.item.title}</Text>
							{row.status.hasSchedule ? (
								<Text style={styles.meta}>
									{formatDueLine(row.status)}
								</Text>
							) : (
								<Text style={styles.meta}>Интервал не задан</Text>
							)}
						</View>
						<Text style={[styles.badge, badgeColor(row.status.urgency)]}>
							{urgencyLabel(row.status.urgency)}
						</Text>
					</Pressable>
				)}
				contentContainerStyle={{ paddingBottom: spacing.lg }}
			/>
			<PrimaryButton
				label="Добавить ТО"
				onPress={() => router.push('/maintenance/edit')}
			/>
		</Screen>
	)
}

function formatDueLine(status: {
	urgency: MaintenanceUrgency
	remainingKm?: number
	remainingDays?: number
}): string {
	const parts: string[] = []
	if (status.remainingKm !== undefined) {
		if (status.urgency === 'overdue') {
			parts.push(
				`Просрочено на ${Math.abs(status.remainingKm).toLocaleString('ru-RU')} км`,
			)
		} else {
			parts.push(`Через ${status.remainingKm.toLocaleString('ru-RU')} км`)
		}
	}
	if (status.remainingDays !== undefined) {
		if (status.urgency === 'overdue') {
			parts.push(`просрочено на ${Math.abs(status.remainingDays)} дн.`)
		} else {
			parts.push(`через ${status.remainingDays} дн.`)
		}
	}
	return parts.join(' · ') || 'По графику'
}

function badgeColor(urgency: MaintenanceUrgency) {
	switch (urgency) {
		case 'overdue':
			return { color: colors.error }
		case 'soon':
			return { color: colors.warning }
		case 'ok':
			return { color: colors.success }
		default:
			return { color: colors.textMuted }
	}
}

const styles = StyleSheet.create({
	list: {
		flex: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	row: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		marginBottom: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
		flexDirection: 'row',
		alignItems: 'center',
	},
	name: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.textPrimary,
	},
	meta: {
		marginTop: 4,
		fontSize: 13,
		color: colors.textSecondary,
	},
	badge: {
		fontSize: 12,
		fontWeight: '700',
	},
	muted: {
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
})
