import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { PrimaryButton, Screen } from '@/ui/components'

/** Vehicle list with active selection. */
export function VehiclesScreen() {
	const router = useRouter()
	const { vehicles, activeVehicleId, selectVehicle } = useJournal()

	return (
		<Screen>
			<Text style={styles.title}>Автомобили</Text>
			<FlatList
				style={styles.list}
				data={vehicles}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={
					<Text style={styles.empty}>Пока нет автомобилей</Text>
				}
				renderItem={({ item }) => {
					const selected = item.id === activeVehicleId
					return (
						<Pressable
							style={[styles.row, selected ? styles.rowSelected : null]}
							onPress={() => {
								void selectVehicle(item.id)
							}}
							onLongPress={() => {
								router.push({
									pathname: '/vehicles/edit',
									params: { id: item.id },
								})
							}}
						>
							<View style={{ flex: 1 }}>
								<Text style={styles.name}>{item.displayName}</Text>
								<Text style={styles.meta}>
									{[item.make, item.model].filter(Boolean).join(' ') || item.fuelType}
									{' · '}
									{item.currentOdometerKm.toLocaleString('ru-RU')} км
								</Text>
							</View>
							{selected ? <Text style={styles.badge}>активен</Text> : null}
						</Pressable>
					)
				}}
				contentContainerStyle={{ paddingBottom: spacing.lg }}
			/>
			<PrimaryButton
				label="Добавить автомобиль"
				onPress={() => router.push('/vehicles/edit')}
			/>
			<Pressable
				style={styles.hintTap}
				onPress={() =>
					Alert.alert(
						'Подсказка',
						'Короткое нажатие — сделать активным. Долгое — редактировать.',
					)
				}
			>
				<Text style={styles.hint}>Короткое нажатие — активный · долгое — правка</Text>
			</Pressable>
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
	rowSelected: {
		borderColor: colors.accent,
	},
	name: {
		fontSize: 17,
		fontWeight: '600',
		color: colors.textPrimary,
	},
	meta: {
		marginTop: 4,
		fontSize: 13,
		color: colors.textMuted,
	},
	badge: {
		fontSize: 12,
		fontWeight: '700',
		color: colors.accent,
	},
	empty: {
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	hintTap: {
		marginTop: spacing.sm,
		alignItems: 'center',
	},
	hint: {
		fontSize: 12,
		color: colors.textMuted,
	},
})
