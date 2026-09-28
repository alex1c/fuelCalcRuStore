/**
 * Bottom-tab glyphs drawn with expo-symbols (already pulled in by expo-router).
 * Android uses Material Symbols; iOS uses the matching SF Symbol.
 * Active and inactive states differ by weight and by the tint passed in.
 */

import type { ColorValue } from 'react-native'
import { SymbolView } from 'expo-symbols'
import boldWeight from 'expo-symbols/androidWeights/bold'
import regularWeight from 'expo-symbols/androidWeights/regular'

export type TabIconName =
	| 'home'
	| 'history'
	| 'maintenance'
	| 'stats'
	| 'more'

const TAB_SYMBOLS = {
	home: {
		ios: 'house',
		android: 'home',
		web: 'home',
	},
	history: {
		ios: 'clock',
		android: 'history',
		web: 'history',
	},
	maintenance: {
		ios: 'wrench.and.screwdriver',
		android: 'car_repair',
		web: 'car_repair',
	},
	stats: {
		ios: 'chart.bar',
		android: 'bar_chart',
		web: 'bar_chart',
	},
	more: {
		ios: 'ellipsis.circle',
		android: 'more_horiz',
		web: 'more_horiz',
	},
} as const

interface TabSymbolProps {
	name: TabIconName
	color: ColorValue
	size?: number
	focused: boolean
}

/** Renders one tab glyph. The parent supplies the active/inactive color. */
export function TabSymbol({
	name,
	color,
	size = 22,
	focused,
}: TabSymbolProps) {
	return (
		<SymbolView
			name={TAB_SYMBOLS[name]}
			size={size}
			tintColor={color}
			weight={{
				ios: focused ? 'bold' : 'regular',
				android: focused ? boldWeight : regularWeight,
			}}
		/>
	)
}
