/**
 * Persistent bottom chrome shared by the root stack.
 *
 * Layout, top to bottom:
 *   screen content (and the tab bar, when the tabs route is visible)
 *   banner, on browsing screens only
 *   system bottom inset
 *
 * The banner is a sibling of the navigator, so its position does not depend
 * on how much content the current screen has. Form routes omit the banner
 * so the keyboard and the save button keep the bottom of the screen.
 */

import { useEffect, useState } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
import { useSegments } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { JournalBanner } from '@/services/ads/journal-banner'
import { colors } from '@/theme/tokens'
import { shouldShowShellBanner } from '@/ui/shell-banner-policy'

/** True while the soft keyboard is covering the bottom of the window. */
function useKeyboardVisible(): boolean {
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const showSub = Keyboard.addListener('keyboardDidShow', () => {
			setVisible(true)
		})
		const hideSub = Keyboard.addListener('keyboardDidHide', () => {
			setVisible(false)
		})
		return () => {
			showSub.remove()
			hideSub.remove()
		}
	}, [])

	return visible
}

/**
 * Bottom ad slot plus the system navigation / gesture inset.
 * Hidden while the keyboard is open so a resized form is not pushed again.
 */
export function AppShellFooter() {
	const segments = useSegments()
	const insets = useSafeAreaInsets()
	const keyboardVisible = useKeyboardVisible()
	const showBanner = shouldShowShellBanner(segments) && !keyboardVisible
	const bottomInset = keyboardVisible ? 0 : insets.bottom

	return (
		<View
			style={[
				styles.footer,
				{
					backgroundColor: showBanner
						? colors.surface
						: colors.background,
					paddingBottom: bottomInset,
				},
			]}
		>
			{showBanner ? (
				<JournalBanner
					visible
					placement="shell_banner"
					remountKey="app-shell"
					style={styles.banner}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	footer: {
		width: '100%',
	},
	banner: {
		marginTop: 0,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
})
