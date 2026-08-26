import { ScrollView, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { PrimaryButton, Screen, SecondaryButton } from '@/ui/components'

/** Settings: vehicles switcher entry point. */
export function SettingsScreen() {
	const router = useRouter()
	const { activeVehicle, vehicles } = useJournal()

	return (
		<Screen>
			<ScrollView>
				<Text style={styles.title}>Настройки</Text>
				<Text style={styles.meta}>
					Активный автомобиль:{' '}
					{activeVehicle?.displayName ?? 'не выбран'}
				</Text>
				<Text style={styles.meta}>Всего автомобилей: {vehicles.length}</Text>
				<PrimaryButton
					label="Автомобили"
					onPress={() => router.push('/vehicles')}
				/>
				<SecondaryButton
					label="Добавить автомобиль"
					onPress={() => router.push('/vehicles/edit')}
				/>
				<Text style={styles.note}>
					Backup, CSV и уведомления появятся в следующих фазах.
				</Text>
			</ScrollView>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	meta: {
		fontSize: 14,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	note: {
		marginTop: spacing.lg,
		fontSize: 13,
		color: colors.textMuted,
	},
})
