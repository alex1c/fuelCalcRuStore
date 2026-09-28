import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { initializeAppServices } from '@/services'
import { JournalProvider } from '@/state/journal-context'
import { colors } from '@/theme/tokens'
import { AppShellFooter } from '@/ui/app-shell-footer'

/** Root stack: tabs + modal-like edit screens. */
export default function RootLayout() {
	useEffect(() => {
		initializeAppServices()
	}, [])

	return (
		<JournalProvider>
			<StatusBar style="dark" />
			{/*
			 * Column shell: navigator fills the space above the footer.
			 * The footer owns the banner and the system bottom inset, so
			 * neither depends on the length of the current screen.
			 */}
			<View style={styles.shell}>
				<View style={styles.navigator}>
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
						<Stack.Screen
							name="expenses/edit"
							options={{ title: 'Расход' }}
						/>
						<Stack.Screen
							name="maintenance/edit"
							options={{ title: 'ТО' }}
						/>
						<Stack.Screen
							name="trip"
							options={{ title: 'Калькулятор поездки' }}
						/>
					</Stack>
				</View>
				<AppShellFooter />
			</View>
		</JournalProvider>
	)
}

const styles = StyleSheet.create({
	shell: {
		flex: 1,
		backgroundColor: colors.background,
	},
	navigator: {
		flex: 1,
	},
})
