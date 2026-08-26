/**
 * Expo Notifications adapter for maintenance date reminders.
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { MaintenanceItem } from '@/domain/maintenance'
import {
	buildReminderPlan,
	reminderNotificationIds,
} from './reminder-plan'

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
})

export type NotificationPermissionStatus =
	| 'granted'
	| 'denied'
	| 'undetermined'

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
	const settings = await Notifications.getPermissionsAsync()
	if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
		return 'granted'
	}
	if (settings.canAskAgain === false) {
		return 'denied'
	}
	return settings.status === 'undetermined' ? 'undetermined' : 'denied'
}

/**
 * Requests notification permission when the user enables reminders.
 * Returns true when scheduling is allowed.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
	const current = await getNotificationPermissionStatus()
	if (current === 'granted') {
		return true
	}
	if (current === 'denied') {
		return false
	}
	const asked = await Notifications.requestPermissionsAsync()
	return Boolean(asked.granted)
}

/** Cancels scheduled notifications for one maintenance item. */
export async function cancelMaintenanceReminders(
	maintenanceId: string,
): Promise<void> {
	for (const id of reminderNotificationIds(maintenanceId)) {
		await Notifications.cancelScheduledNotificationAsync(id)
	}
}

/**
 * Cancels previous schedules and creates new ones from the reminder plan.
 * Set requestPermission=false for silent app-start reschedule.
 */
export async function syncMaintenanceReminders(
	item: MaintenanceItem,
	nowIso = new Date().toISOString(),
	options: { requestPermission?: boolean } = {},
): Promise<void> {
	await cancelMaintenanceReminders(item.id)

	if (!item.remind || !item.active) {
		return
	}

	const requestPermission = options.requestPermission ?? true
	let permitted = (await getNotificationPermissionStatus()) === 'granted'
	if (!permitted && requestPermission) {
		permitted = await ensureNotificationPermission()
	}
	if (!permitted) {
		return
	}

	if (Platform.OS === 'android') {
		await Notifications.setNotificationChannelAsync('maintenance', {
			name: 'Обслуживание',
			importance: Notifications.AndroidImportance.DEFAULT,
		})
	}

	const plan = buildReminderPlan(item, nowIso)
	for (const entry of plan) {
		const fireAt = new Date(entry.fireAtIso)
		if (fireAt.getTime() <= Date.now()) {
			continue
		}
		await Notifications.scheduleNotificationAsync({
			identifier: entry.id,
			content: {
				title: entry.title,
				body: entry.body,
				sound: false,
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: fireAt,
				channelId: Platform.OS === 'android' ? 'maintenance' : undefined,
			},
		})
	}
}

/** Reschedules all active remind items after restore / app start (no permission prompt). */
export async function rescheduleAllMaintenanceReminders(
	items: MaintenanceItem[],
	nowIso = new Date().toISOString(),
): Promise<void> {
	for (const item of items) {
		await syncMaintenanceReminders(item, nowIso, { requestPermission: false })
	}
}
