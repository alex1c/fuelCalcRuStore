/**
 * Centralized maintenance urgency thresholds — do not scatter in UI.
 */
export const MAINTENANCE_THRESHOLDS = {
	/** Remaining km above this → OK; 0..this → soon; below 0 → overdue. */
	kmSoonMax: 1000,
	/** Remaining days above this → OK; 0..this → soon; below 0 → overdue. */
	daysSoonMax: 30,
} as const

export type MaintenanceUrgency = 'ok' | 'soon' | 'overdue' | 'none'

export interface MaintenanceItem {
	id: string
	vehicleId: string
	title: string
	lastServiceDate?: string
	lastServiceOdometerKm?: number
	intervalKm?: number
	intervalDays?: number
	note?: string
	active: boolean
	/** When true and a due date exists, schedule local date reminders. */
	remind: boolean
	createdAt: string
	updatedAt: string
}

export interface MaintenanceDueStatus {
	remainingKm?: number
	remainingDays?: number
	nextServiceDateIso?: string
	/** True when at least one interval is configured and due math is possible. */
	hasSchedule: boolean
	isOverdue: boolean
	urgencyKm: MaintenanceUrgency
	urgencyDays: MaintenanceUrgency
	/** Worst of km/days urgencies for list badges. */
	urgency: MaintenanceUrgency
}

function urgencyFromRemaining(
	remaining: number | undefined,
	soonMax: number,
): MaintenanceUrgency {
	if (remaining === undefined) {
		return 'none'
	}
	if (remaining < 0) {
		return 'overdue'
	}
	if (remaining <= soonMax) {
		return 'soon'
	}
	return 'ok'
}

function worstUrgency(
	a: MaintenanceUrgency,
	b: MaintenanceUrgency,
): MaintenanceUrgency {
	const rank: Record<MaintenanceUrgency, number> = {
		none: 0,
		ok: 1,
		soon: 2,
		overdue: 3,
	}
	return rank[a] >= rank[b] ? a : b
}

/**
 * Computes remaining km/days and urgency for reminder UI.
 * No notification side effects — pure status only.
 */
export function getMaintenanceDueStatus(
	item: MaintenanceItem,
	now: { dateIso: string; odometerKm: number },
): MaintenanceDueStatus {
	if (!item.active) {
		return {
			hasSchedule: false,
			isOverdue: false,
			urgencyKm: 'none',
			urgencyDays: 'none',
			urgency: 'none',
		}
	}

	const hasKm =
		item.intervalKm !== undefined &&
		item.intervalKm > 0 &&
		item.lastServiceOdometerKm !== undefined

	const hasDays =
		item.intervalDays !== undefined &&
		item.intervalDays > 0 &&
		item.lastServiceDate !== undefined

	if (!hasKm && !hasDays) {
		return {
			hasSchedule: false,
			isOverdue: false,
			urgencyKm: 'none',
			urgencyDays: 'none',
			urgency: 'none',
		}
	}

	let remainingKm: number | undefined
	let remainingDays: number | undefined
	let nextServiceDateIso: string | undefined

	if (hasKm && item.lastServiceOdometerKm !== undefined && item.intervalKm !== undefined) {
		const dueAt = item.lastServiceOdometerKm + item.intervalKm
		remainingKm = dueAt - now.odometerKm
	}

	if (hasDays && item.lastServiceDate !== undefined && item.intervalDays !== undefined) {
		const lastMs = Date.parse(item.lastServiceDate)
		const nowMs = Date.parse(now.dateIso)

		if (Number.isFinite(lastMs) && Number.isFinite(nowMs)) {
			const dueMs = lastMs + item.intervalDays * 24 * 60 * 60 * 1000
			remainingDays = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000))
			nextServiceDateIso = new Date(dueMs).toISOString()
		}
	}

	const urgencyKm = urgencyFromRemaining(
		remainingKm,
		MAINTENANCE_THRESHOLDS.kmSoonMax,
	)
	const urgencyDays = urgencyFromRemaining(
		remainingDays,
		MAINTENANCE_THRESHOLDS.daysSoonMax,
	)
	const urgency = worstUrgency(urgencyKm, urgencyDays)
	const isOverdue = urgency === 'overdue'

	return {
		hasSchedule: true,
		remainingKm,
		remainingDays,
		nextServiceDateIso,
		isOverdue,
		urgencyKm,
		urgencyDays,
		urgency,
	}
}

/**
 * Marks a maintenance item as completed at the given date/odometer.
 * Returns a new item; does not mutate the input.
 */
export function completeMaintenance(
	item: MaintenanceItem,
	completion: { dateIso: string; odometerKm: number; nowIso: string },
): MaintenanceItem {
	return {
		...item,
		lastServiceDate: completion.dateIso,
		lastServiceOdometerKm: completion.odometerKm,
		updatedAt: completion.nowIso,
	}
}
