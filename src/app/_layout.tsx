import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { JournalProvider } from '@/state/journal-context'
import { colors } from '@/theme/tokens'

/** Root stack: tabs + modal-like edit screens. */
export default function RootLayout() {
	return (
		<JournalProvider>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					contentStyle: { backgroundColor: colors.background },
					headerStyle: { backgroundColor: colors.background },
					headerTintColor: colors.accent,
					headerTitleStyle: {
						color: colors.textPrimary,
						fontWeight: '600',
					},
					headerShadowVisible: false,
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="vehicles/index"
					options={{ title: 'Автомобили' }}
				/>
				<Stack.Screen
					name="vehicles/edit"
					options={{ title: 'Автомобиль' }}
				/>
				<Stack.Screen name="fuel/new" options={{ title: 'Заправка' }} />
				<Stack.Screen name="fuel/edit" options={{ title: 'Заправка' }} />
				<Stack.Screen name="expenses/edit" options={{ title: 'Расход' }} />
				<Stack.Screen
					name="maintenance/edit"
					options={{ title: 'ТО' }}
				/>
			</Stack>
		</JournalProvider>
	)
}
