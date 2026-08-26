import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors } from '@/theme/tokens'

function TabLabel({
	label,
	focused,
}: {
	label: string
	focused: boolean
}) {
	return (
		<Text
			style={{
				fontSize: 11,
				fontWeight: focused ? '700' : '500',
				color: focused ? colors.accent : colors.textMuted,
			}}
		>
			{label}
		</Text>
	)
}

/** Bottom tabs: home / history / maintenance / stats / settings. */
export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				headerTintColor: colors.textPrimary,
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
				},
				// Text-only tabs — avoid default broken placeholder icons.
				tabBarIcon: () => null,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Главная',
					tabBarLabel: ({ focused }) => (
						<TabLabel label="Главная" focused={focused} />
					),
				}}
			/>
			<Tabs.Screen
				name="history"
				options={{
					title: 'История',
					tabBarLabel: ({ focused }) => (
						<TabLabel label="История" focused={focused} />
					),
				}}
			/>
			<Tabs.Screen
				name="maintenance"
				options={{
					title: 'ТО',
					tabBarLabel: ({ focused }) => (
						<TabLabel label="ТО" focused={focused} />
					),
				}}
			/>
			<Tabs.Screen
				name="stats"
				options={{
					title: 'Статистика',
					tabBarLabel: ({ focused }) => (
						<TabLabel label="Стат." focused={focused} />
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: 'Ещё',
					tabBarLabel: ({ focused }) => (
						<TabLabel label="Ещё" focused={focused} />
					),
				}}
			/>
		</Tabs>
	)
}
