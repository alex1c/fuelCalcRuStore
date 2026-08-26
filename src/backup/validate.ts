/**
 * Backup validation — never trust a .json extension alone.
 */

import {
	EXPENSE_CATEGORIES,
	type ExpenseCategory,
	type FuelType,
} from '@/domain/shared/types'
import {
	BACKUP_FORMAT,
	BACKUP_VERSION,
	type AutoJournalBackupV1,
} from '@/persistence/backup-types'

export type BackupValidationErrorCode =
	| 'INVALID_JSON'
	| 'WRONG_FORMAT'
	| 'UNSUPPORTED_VERSION'
	| 'INVALID_STRUCTURE'
	| 'DUPLICATE_ID'
	| 'ORPHAN_REFERENCE'
	| 'INVALID_FIELD'

export type BackupValidationResult =
	| { ok: true; backup: AutoJournalBackupV1 }
	| { ok: false; code: BackupValidationErrorCode; detail?: string }

type FieldResult = { ok: true } | { ok: false; code: BackupValidationErrorCode; detail?: string }

const FUEL_TYPES: readonly FuelType[] = [
	'petrol92',
	'petrol95',
	'petrol98',
	'diesel',
	'lpg',
	'electric',
	'other',
]

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0
}

function isIsoDateString(value: unknown): value is string {
	return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)
}

function isNonNegInt(value: unknown): value is number {
	return isInt(value) && value >= 0
}

/** Parses raw text then validates a backup document. */
export function parseAndValidateBackup(raw: string): BackupValidationResult {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw) as unknown
	} catch {
		return { ok: false, code: 'INVALID_JSON' }
	}
	return validateBackupDocument(parsed)
}

/** Validates an already-parsed JSON value as AutoJournal backup v1. */
export function validateBackupDocument(value: unknown): BackupValidationResult {
	if (!isRecord(value)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'root' }
	}

	if (value.format !== BACKUP_FORMAT) {
		return { ok: false, code: 'WRONG_FORMAT' }
	}

	if (typeof value.version !== 'number' || value.version !== BACKUP_VERSION) {
		return { ok: false, code: 'UNSUPPORTED_VERSION' }
	}

	if (!isIsoDateString(value.createdAt) || !isNonEmptyString(value.appVersion)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'meta' }
	}

	if (
		!Array.isArray(value.vehicles) ||
		!Array.isArray(value.fuelEntries) ||
		!Array.isArray(value.expenses) ||
		!Array.isArray(value.maintenance) ||
		!isRecord(value.settings)
	) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'collections' }
	}

	if (value.settings.currencyCode !== 'RUB') {
		return { ok: false, code: 'INVALID_FIELD', detail: 'settings.currencyCode' }
	}

	const activeVehicleId = value.settings.activeVehicleId
	if (activeVehicleId !== undefined && !isNonEmptyString(activeVehicleId)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'settings.activeVehicleId' }
	}

	const vehicleIds = new Set<string>()
	for (const rawVehicle of value.vehicles) {
		const result = validateVehicle(rawVehicle, vehicleIds)
		if (!result.ok) {
			return result
		}
	}

	if (activeVehicleId !== undefined && !vehicleIds.has(activeVehicleId)) {
		return { ok: false, code: 'ORPHAN_REFERENCE', detail: 'settings.activeVehicleId' }
	}

	const fuelIds = new Set<string>()
	for (const rawFuel of value.fuelEntries) {
		const result = validateFuel(rawFuel, vehicleIds, fuelIds)
		if (!result.ok) {
			return result
		}
	}

	const expenseIds = new Set<string>()
	for (const rawExpense of value.expenses) {
		const result = validateExpense(rawExpense, vehicleIds, expenseIds)
		if (!result.ok) {
			return result
		}
	}

	const maintenanceIds = new Set<string>()
	for (const rawItem of value.maintenance) {
		const result = validateMaintenance(rawItem, vehicleIds, maintenanceIds)
		if (!result.ok) {
			return result
		}
	}

	return { ok: true, backup: value as unknown as AutoJournalBackupV1 }
}

function validateVehicle(raw: unknown, seen: Set<string>): FieldResult {
	if (!isRecord(raw)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'vehicle' }
	}
	if (!isNonEmptyString(raw.id)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'vehicle.id' }
	}
	if (seen.has(raw.id)) {
		return { ok: false, code: 'DUPLICATE_ID', detail: `vehicle:${raw.id}` }
	}
	seen.add(raw.id)

	if (!isNonEmptyString(raw.displayName)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'vehicle.displayName' }
	}
	if (!FUEL_TYPES.includes(raw.fuelType as FuelType)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'vehicle.fuelType' }
	}
	if (!isNonNegInt(raw.currentOdometerKm)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'vehicle.currentOdometerKm' }
	}
	if (!isIsoDateString(raw.createdAt) || !isIsoDateString(raw.updatedAt)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'vehicle.timestamps' }
	}
	return { ok: true }
}

function validateFuel(
	raw: unknown,
	vehicleIds: Set<string>,
	seen: Set<string>,
): FieldResult {
	if (!isRecord(raw)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'fuel' }
	}
	if (!isNonEmptyString(raw.id)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'fuel.id' }
	}
	if (seen.has(raw.id)) {
		return { ok: false, code: 'DUPLICATE_ID', detail: `fuel:${raw.id}` }
	}
	seen.add(raw.id)

	if (!isNonEmptyString(raw.vehicleId) || !vehicleIds.has(raw.vehicleId)) {
		return { ok: false, code: 'ORPHAN_REFERENCE', detail: `fuel:${raw.id}` }
	}
	if (
		!isIsoDateString(raw.recordedAt) ||
		!isNonNegInt(raw.odometerKm) ||
		!isNonNegInt(raw.litersMl) ||
		!isNonNegInt(raw.totalCostKopecks) ||
		!isNonNegInt(raw.pricePerLiterKopecks) ||
		typeof raw.fullTank !== 'boolean' ||
		!isIsoDateString(raw.createdAt) ||
		!isIsoDateString(raw.updatedAt)
	) {
		return { ok: false, code: 'INVALID_FIELD', detail: `fuel:${raw.id}` }
	}
	return { ok: true }
}

function validateExpense(
	raw: unknown,
	vehicleIds: Set<string>,
	seen: Set<string>,
): FieldResult {
	if (!isRecord(raw)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'expense' }
	}
	if (!isNonEmptyString(raw.id)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'expense.id' }
	}
	if (seen.has(raw.id)) {
		return { ok: false, code: 'DUPLICATE_ID', detail: `expense:${raw.id}` }
	}
	seen.add(raw.id)

	if (!isNonEmptyString(raw.vehicleId) || !vehicleIds.has(raw.vehicleId)) {
		return { ok: false, code: 'ORPHAN_REFERENCE', detail: `expense:${raw.id}` }
	}
	if (!EXPENSE_CATEGORIES.includes(raw.category as ExpenseCategory)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'expense.category' }
	}
	if (
		!isIsoDateString(raw.recordedAt) ||
		!isNonNegInt(raw.amountKopecks) ||
		!isIsoDateString(raw.createdAt) ||
		!isIsoDateString(raw.updatedAt)
	) {
		return { ok: false, code: 'INVALID_FIELD', detail: `expense:${raw.id}` }
	}
	if (raw.odometerKm !== undefined && !isNonNegInt(raw.odometerKm)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'expense.odometerKm' }
	}
	return { ok: true }
}

function validateMaintenance(
	raw: unknown,
	vehicleIds: Set<string>,
	seen: Set<string>,
): FieldResult {
	if (!isRecord(raw)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'maintenance' }
	}
	if (!isNonEmptyString(raw.id)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'maintenance.id' }
	}
	if (seen.has(raw.id)) {
		return { ok: false, code: 'DUPLICATE_ID', detail: `maintenance:${raw.id}` }
	}
	seen.add(raw.id)

	if (!isNonEmptyString(raw.vehicleId) || !vehicleIds.has(raw.vehicleId)) {
		return { ok: false, code: 'ORPHAN_REFERENCE', detail: `maintenance:${raw.id}` }
	}
	if (
		!isNonEmptyString(raw.title) ||
		typeof raw.active !== 'boolean' ||
		!isIsoDateString(raw.createdAt) ||
		!isIsoDateString(raw.updatedAt)
	) {
		return { ok: false, code: 'INVALID_FIELD', detail: `maintenance:${raw.id}` }
	}
	if (raw.lastServiceDate !== undefined && !isIsoDateString(raw.lastServiceDate)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'maintenance.lastServiceDate' }
	}
	if (
		raw.lastServiceOdometerKm !== undefined &&
		!isNonNegInt(raw.lastServiceOdometerKm)
	) {
		return {
			ok: false,
			code: 'INVALID_FIELD',
			detail: 'maintenance.lastServiceOdometerKm',
		}
	}
	if (raw.intervalKm !== undefined && !(isInt(raw.intervalKm) && raw.intervalKm > 0)) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'maintenance.intervalKm' }
	}
	if (
		raw.intervalDays !== undefined &&
		!(isInt(raw.intervalDays) && raw.intervalDays > 0)
	) {
		return { ok: false, code: 'INVALID_FIELD', detail: 'maintenance.intervalDays' }
	}
	if (raw.remind !== undefined && typeof raw.remind !== 'boolean') {
		return { ok: false, code: 'INVALID_FIELD', detail: 'maintenance.remind' }
	}
	return { ok: true }
}
