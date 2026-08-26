/**
 * Pure scheduling plan for maintenance date reminders.
 * Native expo-notifications adapter lives in reminders-service.ts.
 */

import { getMaintenanceDueStatus, type MaintenanceItem } from '@/domain/maintenance'

/** Days before due date to fire a "soon" reminder. */
export const REMINDER_DAYS_BEFORE = 7 as const

export interface ReminderPlanItem {
	/** Stable notification identifier for cancel/reschedule. */
	id: string
	fireAtIso: string
	title: string
	body: string
}

/**
 * Deterministic notification ids for a maintenance item.
 * Used to cancel orphans on edit/delete.
 */
export function reminderNotificationIds(maintenanceId: string): string[] {
	return [
		`maint-${maintenanceId}-soon`,
		`maint-${maintenanceId}-due`,
	]
}

/**
 * Builds local reminder fire times from maintenance due date.
 * Returns empty when remind is off, inactive, or no date schedule exists.
 */
export function buildReminderPlan(
	item: MaintenanceItem,
	nowIso: string,
): ReminderPlanItem[] {
	if (!item.remind || !item.active) {
		return []
	}

	const status = getMaintenanceDueStatus(item, {
		dateIso: nowIso,
		odometerKm: item.lastServiceOdometerKm ?? 0,
	})

	if (!status.nextServiceDateIso) {
		return []
	}

	const dueMs = Date.parse(status.nextServiceDateIso)
	if (!Number.isFinite(dueMs)) {
		return []
	}

	const nowMs = Date.parse(nowIso)
	const plans: ReminderPlanItem[] = []
	const [soonId, dueId] = reminderNotificationIds(item.id)

	const soonMs = dueMs - REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000
	if (soonMs > nowMs) {
		plans.push({
			id: soonId,
			fireAtIso: new Date(soonMs).toISOString(),
			title: 'Скоро обслуживание',
			body: `${item.title} — через ${REMINDER_DAYS_BEFORE} дн.`,
		})
	}

	if (dueMs > nowMs) {
		plans.push({
			id: dueId,
			fireAtIso: new Date(dueMs).toISOString(),
			title: 'День обслуживания',
			body: `${item.title} — пора выполнить ТО`,
		})
	}

	return plans
}
