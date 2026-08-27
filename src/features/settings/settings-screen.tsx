import { useCallback, useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import {
	backupPreviewCounts,
	buildBackupFromDatabase,
	migrateBackupToCurrentVersion,
	restoreBackupReplaceAll,
	serializeBackup,
	type BackupPreviewCounts,
} from '@/backup'
import {
	csvFileName,
	serializeExpensesCsv,
	serializeFuelCsv,
} from '@/export/csv'
import { buildShareReportText } from '@/export/share-report'
import { kopecksToMajor } from '@/domain/shared/money'
import { mlToLiters } from '@/domain/shared/volume'
import { backupFileName } from '@/persistence'
import {
	getNotificationPermissionStatus,
	rescheduleAllMaintenanceReminders,
	type NotificationPermissionStatus,
} from '@/notifications/reminders-service'
import { getAnalyticsService } from '@/services/analytics'
import {
	shareLocalFile,
	sharePlainText,
	writeCacheFile,
} from '@/services/files'
import { useJournal } from '@/state/journal-context'
import { colors, spacing } from '@/theme/tokens'
import { PrimaryButton, Screen, SecondaryButton } from '@/ui/components'
import { expenseCategoryLabel } from '@/ui/labels'

const RESTORE_UNSUPPORTED =
	'Не удалось восстановить резервную копию. Файл повреждён или имеет неподдерживаемый формат.'

/** Settings + data tools: backup, CSV, share, notification status. */
export function SettingsScreen() {
	const router = useRouter()
	const {
		activeVehicle,
		vehicles,
		activeFuelEntries,
		activeExpenses,
		maintenance,
		refresh,
	} = useJournal()

	const [busy, setBusy] = useState<string | null>(null)
	const [permission, setPermission] =
		useState<NotificationPermissionStatus>('undetermined')

	const refreshPermission = useCallback(async () => {
		const status = await getNotificationPermissionStatus()
		setPermission(status)
	}, [])

	useEffect(() => {
		void refreshPermission()
	}, [refreshPermission])

	async function handleCreateBackup() {
		if (busy) {
			return
		}
		setBusy('Создание резервной копии…')
		try {
			const backup = await buildBackupFromDatabase()
			const json = serializeBackup(backup)
			const name = backupFileName(backup.createdAt)
			const uri = await writeCacheFile(name, json)
			const shared = await shareLocalFile(uri, {
				mimeType: 'application/json',
				dialogTitle: 'Сохранить резервную копию',
			})
			if (shared.status === 'failed') {
				Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
			} else if (shared.status === 'shared') {
				getAnalyticsService().track('backup_created')
			}
		} catch {
			Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
		} finally {
			setBusy(null)
		}
	}

	async function handleRestoreBackup() {
		if (busy) {
			return
		}
		try {
			const picked = await DocumentPicker.getDocumentAsync({
				type: ['application/json', 'public.json', '*/*'],
				copyToCacheDirectory: true,
				multiple: false,
			})
			if (picked.canceled || !picked.assets?.[0]) {
				return
			}

			setBusy('Чтение резервной копии…')
			const asset = picked.assets[0]
			const response = await fetch(asset.uri)
			const raw = await response.text()

			let parsed: unknown
			try {
				parsed = JSON.parse(raw)
			} catch {
				Alert.alert('Ошибка', RESTORE_UNSUPPORTED)
				return
			}

			const migrated = migrateBackupToCurrentVersion(parsed)
			if (!migrated.ok) {
				Alert.alert('Ошибка', RESTORE_UNSUPPORTED)
				return
			}

			const preview = backupPreviewCounts(migrated.backup)
			setBusy(null)
			confirmRestore(preview, () => {
				void (async () => {
					setBusy('Восстановление данных…')
					getAnalyticsService().track('backup_restore_started')
					try {
						const result = await restoreBackupReplaceAll(migrated.backup)
						if (!result.ok) {
							getAnalyticsService().track('backup_restore_failed')
							Alert.alert(
								'Ошибка',
								'Восстановление отменено. Ваши данные не изменены.',
							)
							return
						}
						await refresh()
						await rescheduleAllMaintenanceReminders(
							migrated.backup.maintenance,
						)
						getAnalyticsService().track('backup_restore_success')
						Alert.alert('Готово', 'Данные восстановлены из резервной копии.')
					} catch {
						getAnalyticsService().track('backup_restore_failed')
						Alert.alert(
							'Ошибка',
							'Восстановление отменено. Ваши данные не изменены.',
						)
					} finally {
						setBusy(null)
					}
				})()
			})
		} catch {
			Alert.alert('Ошибка', RESTORE_UNSUPPORTED)
			setBusy(null)
		} finally {
			// Keep busy only while reading; confirm dialog clears it above.
			setBusy((current) =>
				current === 'Чтение резервной копии…' ? null : current,
			)
		}
	}

	function confirmRestore(
		preview: BackupPreviewCounts,
		onConfirm: () => void,
	) {
		const created = formatRuDate(preview.createdAt)
		Alert.alert(
			'Резервная копия',
			[
				`Создана: ${created}`,
				`Автомобилей: ${preview.vehicleCount}`,
				`Заправок: ${preview.fuelCount}`,
				`Расходов: ${preview.expenseCount}`,
				`ТО: ${preview.maintenanceCount}`,
				'',
				'После подтверждения данные приложения будут заменены данными из резервной копии.',
			].join('\n'),
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Восстановить',
					style: 'destructive',
					onPress: onConfirm,
				},
			],
		)
	}

	async function handleExportFuelCsv() {
		if (busy) {
			return
		}
		setBusy('Экспорт заправок…')
		try {
			const nameById = Object.fromEntries(
				vehicles.map((vehicle) => [vehicle.id, vehicle.displayName]),
			)
			const { listFuelEntries } = await import('@/persistence')
			const entries = await listFuelEntries()
			const csv = serializeFuelCsv(
				entries.map((entry) => ({
					vehicleName: nameById[entry.vehicleId] ?? entry.vehicleId,
					recordedAt: entry.recordedAt,
					odometerKm: entry.odometerKm,
					liters: mlToLiters(entry.litersMl),
					pricePerLiter: kopecksToMajor(entry.pricePerLiterKopecks),
					total: kopecksToMajor(entry.totalCostKopecks),
					fullTank: entry.fullTank,
					note: entry.note,
				})),
			)
			const uri = await writeCacheFile(csvFileName('fuel'), csv)
			const shared = await shareLocalFile(uri, {
				mimeType: 'text/csv',
				dialogTitle: 'Экспорт заправок',
			})
			if (shared.status === 'failed') {
				Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
			} else if (shared.status === 'shared') {
				getAnalyticsService().track('csv_exported', { kind: 'fuel' })
			}
		} catch {
			Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
		} finally {
			setBusy(null)
		}
	}

	async function handleExportExpensesCsv() {
		if (busy) {
			return
		}
		setBusy('Экспорт расходов…')
		try {
			const nameById = Object.fromEntries(
				vehicles.map((vehicle) => [vehicle.id, vehicle.displayName]),
			)
			const { listExpenses } = await import('@/persistence')
			const rows = await listExpenses()
			const csv = serializeExpensesCsv(
				rows.map((expense) => ({
					vehicleName: nameById[expense.vehicleId] ?? expense.vehicleId,
					recordedAt: expense.recordedAt,
					category: expenseCategoryLabel(expense.category),
					amount: kopecksToMajor(expense.amountKopecks),
					odometerKm: expense.odometerKm,
					note: expense.note,
				})),
			)
			const uri = await writeCacheFile(csvFileName('expenses'), csv)
			const shared = await shareLocalFile(uri, {
				mimeType: 'text/csv',
				dialogTitle: 'Экспорт расходов',
			})
			if (shared.status === 'failed') {
				Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
			} else if (shared.status === 'shared') {
				getAnalyticsService().track('csv_exported', { kind: 'expenses' })
			}
		} catch {
			Alert.alert('Ошибка', 'Не удалось создать файл. Попробуйте ещё раз.')
		} finally {
			setBusy(null)
		}
	}

	async function handleShareReport() {
		if (!activeVehicle) {
			Alert.alert('Отчёт', 'Сначала выберите автомобиль.')
			return
		}
		if (busy) {
			return
		}
		setBusy('Подготовка отчёта…')
		try {
			const text = buildShareReportText({
				vehicle: activeVehicle,
				fuelEntries: activeFuelEntries,
				expenses: activeExpenses,
			})
			const shared = await sharePlainText(text)
			if (shared.status === 'failed') {
				Alert.alert('Ошибка', 'Не удалось открыть общий доступ.')
			} else if (shared.status === 'shared') {
				getAnalyticsService().track('report_shared')
			}
		} catch {
			Alert.alert('Ошибка', 'Не удалось открыть общий доступ.')
		} finally {
			setBusy(null)
		}
	}

	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
				<Text style={styles.title}>Настройки</Text>
				<Text style={styles.meta}>
					Активный автомобиль:{' '}
					{activeVehicle?.displayName ?? 'не выбран'}
				</Text>
				<Text style={styles.meta}>Всего автомобилей: {vehicles.length}</Text>
				<PrimaryButton
					label="Автомобили"
					onPress={() => router.push('/vehicles')}
					disabled={Boolean(busy)}
				/>
				<SecondaryButton
					label="Добавить автомобиль"
					onPress={() => router.push('/vehicles/edit')}
					disabled={Boolean(busy)}
				/>

				<Text style={styles.section}>Инструменты</Text>
				<SecondaryButton
					label="Калькулятор поездки"
					onPress={() => router.push('/trip')}
					disabled={Boolean(busy)}
				/>

				<Text style={styles.section}>Данные</Text>
				<SecondaryButton
					label="Создать резервную копию"
					onPress={() => {
						void handleCreateBackup()
					}}
					disabled={Boolean(busy)}
				/>
				<SecondaryButton
					label="Восстановить из резервной копии"
					onPress={() => {
						void handleRestoreBackup()
					}}
					disabled={Boolean(busy)}
				/>
				<SecondaryButton
					label="Экспортировать заправки CSV"
					onPress={() => {
						void handleExportFuelCsv()
					}}
					disabled={Boolean(busy)}
				/>
				<SecondaryButton
					label="Экспортировать расходы CSV"
					onPress={() => {
						void handleExportExpensesCsv()
					}}
					disabled={Boolean(busy)}
				/>

				<Text style={styles.section}>Поделиться</Text>
				<SecondaryButton
					label="Поделиться отчётом"
					onPress={() => {
						void handleShareReport()
					}}
					disabled={Boolean(busy)}
				/>

				<Text style={styles.section}>Напоминания</Text>
				<Text style={styles.meta}>
					Разрешение: {permissionLabel(permission)}
				</Text>
				<Text style={styles.note}>
					Напоминания по дате включаются в карточке ТО («Напомнить»).
					Активных с напоминанием: {maintenance.filter((item) => item.remind).length}
				</Text>

				{busy ? (
					<View style={styles.busy}>
						<ActivityIndicator color={colors.accent} />
						<Text style={styles.busyText}>{busy}</Text>
					</View>
				) : null}
			</ScrollView>
		</Screen>
	)
}

function permissionLabel(status: NotificationPermissionStatus): string {
	switch (status) {
		case 'granted':
			return 'разрешено'
		case 'denied':
			return 'запрещено'
		default:
			return 'не запрошено'
	}
}

function formatRuDate(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) {
		return iso
	}
	return date.toLocaleDateString('ru-RU')
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.textPrimary,
		marginBottom: spacing.md,
	},
	section: {
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
		fontSize: 16,
		fontWeight: '700',
		color: colors.textPrimary,
	},
	meta: {
		fontSize: 14,
		color: colors.textSecondary,
		marginBottom: spacing.sm,
	},
	note: {
		marginTop: spacing.sm,
		fontSize: 13,
		color: colors.textMuted,
	},
	busy: {
		marginTop: spacing.lg,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	busyText: {
		color: colors.textSecondary,
		fontSize: 14,
	},
})
