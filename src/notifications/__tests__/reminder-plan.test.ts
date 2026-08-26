import {
	buildReminderPlan,
	reminderNotificationIds,
	REMINDER_DAYS_BEFORE,
} from '@/notifications/reminder-plan'
import type { MaintenanceItem } from '@/domain/maintenance'

const base: MaintenanceItem = {
	id: 'm1',
	vehicleId: 'v1',
	title: 'ОСАГО',
	lastServiceDate: '2026-08-01T00:00:00.000Z',
	intervalDays: 30,
	active: true,
	remind: true,
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('maintenance reminder plan', () => {
	it('exposes stable cancel/reschedule ids', () => {
		expect(reminderNotificationIds('m1')).toEqual([
			'maint-m1-soon',
			'maint-m1-due',
		])
	})

	it('schedules soon + due when remind and date interval exist', () => {
		const plan = buildReminderPlan(base, '2026-08-05T00:00:00.000Z')
		expect(plan).toHaveLength(2)
		expect(plan[0].id).toBe('maint-m1-soon')
		expect(plan[1].id).toBe('maint-m1-due')
		expect(REMINDER_DAYS_BEFORE).toBe(7)
	})

	it('returns empty without due date or when remind is off', () => {
		expect(
			buildReminderPlan(
				{ ...base, remind: false },
				'2026-08-05T00:00:00.000Z',
			),
		).toEqual([])
		expect(
			buildReminderPlan(
				{
					...base,
					intervalDays: undefined,
					lastServiceDate: undefined,
					intervalKm: 10000,
					lastServiceOdometerKm: 10000,
				},
				'2026-08-05T00:00:00.000Z',
			),
		).toEqual([])
	})
})
