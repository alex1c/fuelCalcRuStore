import { Tabs } from 'expo-router'
import { Text, type ColorValue } from 'react-native'
import { colors } from '@/theme/tokens'
import { TabSymbol, type TabIconName } from '@/ui/tab-symbol'

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

function tabOptions(label: string, icon: TabIconName) {
	return {
		title: label,
		tabBarIcon: ({
			color,
			size,
			focused,
		}: {
			color: ColorValue
			size: number
			focused: boolean
		}) => (
			<TabSymbol
				name={icon}
				color={color}
				size={size}
				focused={focused}
			/>
		),
		tabBarLabel: ({ focused }: { focused: boolean }) => (
			<TabLabel
				label={label === 'Статистика' ? 'Стат.' : label}
				focused={focused}
			/>
		),
	}
}

/**
 * Bottom tabs: home / history / maintenance / stats / settings.
 * Bottom inset is 0 because the root shell draws the system inset
 * under the banner, below this bar.
 */
export default function TabsLayout() {
	return (
		<Tabs
			safeAreaInsets={{ bottom: 0 }}
			screenOptions={{
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				headerTintColor: colors.textPrimary,
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					elevation: 0,
					shadowOpacity: 0,
					// Room for a 24dp glyph and an 11dp label. The system
					// inset lives in the shell footer, under the banner.
					height: 56,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={tabOptions('Главная', 'home')}
			/>
			<Tabs.Screen
				name="history"
				options={tabOptions('История', 'history')}
			/>
			<Tabs.Screen
				name="maintenance"
				options={tabOptions('ТО', 'maintenance')}
			/>
			<Tabs.Screen
				name="stats"
				options={tabOptions('Статистика', 'stats')}
			/>
			<Tabs.Screen
				name="settings"
				options={tabOptions('Ещё', 'more')}
			/>
		</Tabs>
	)
}
