import {
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
	type TextInputProps,
} from 'react-native'
import { colors, spacing } from '@/theme/tokens'

interface ScreenProps {
	children: React.ReactNode
}

export function Screen({ children }: ScreenProps) {
	return <View style={styles.screen}>{children}</View>
}

interface FieldProps extends TextInputProps {
	label: string
	error?: string
}

export function Field({ label, error, style, ...props }: FieldProps) {
	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				{...props}
				style={[styles.input, error ? styles.inputError : null, style]}
				placeholderTextColor={colors.textMuted}
			/>
			{error ? <Text style={styles.error}>{error}</Text> : null}
		</View>
	)
}

interface PrimaryButtonProps {
	label: string
	onPress: () => void
	disabled?: boolean
}

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={({ pressed }) => [
				styles.button,
				pressed ? styles.buttonPressed : null,
				disabled ? styles.buttonDisabled : null,
			]}
		>
			<Text style={styles.buttonLabel}>{label}</Text>
		</Pressable>
	)
}

interface SecondaryButtonProps {
	label: string
	onPress: () => void
	disabled?: boolean
}

export function SecondaryButton({
	label,
	onPress,
	disabled,
}: SecondaryButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={[
				styles.secondaryButton,
				disabled ? styles.buttonDisabled : null,
			]}
		>
			<Text style={styles.secondaryLabel}>{label}</Text>
		</Pressable>
	)
}

interface ChipProps {
	label: string
	selected?: boolean
	onPress: () => void
}

export function Chip({ label, selected, onPress }: ChipProps) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.chip, selected ? styles.chipSelected : null]}
		>
			<Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
		padding: spacing.md,
	},
	field: {
		marginBottom: spacing.md,
	},
	label: {
		fontSize: 13,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	input: {
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 16,
		color: colors.textPrimary,
	},
	inputError: {
		borderColor: colors.error,
	},
	error: {
		marginTop: 4,
		color: colors.error,
		fontSize: 12,
	},
	button: {
		backgroundColor: colors.accent,
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: 'center',
	},
	buttonPressed: {
		backgroundColor: colors.accentPressed,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonLabel: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	secondaryButton: {
		paddingVertical: 12,
		alignItems: 'center',
	},
	secondaryLabel: {
		color: colors.accent,
		fontSize: 15,
		fontWeight: '600',
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		backgroundColor: colors.chip,
		marginRight: 8,
		marginBottom: 8,
	},
	chipSelected: {
		backgroundColor: colors.accent,
	},
	chipLabel: {
		color: colors.textSecondary,
		fontSize: 13,
		fontWeight: '600',
	},
	chipLabelSelected: {
		color: '#FFFFFF',
	},
})
