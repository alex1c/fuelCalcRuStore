/**
 * Backup version migration hook.
 * V1 currently passes through; future versions transform here.
 */

import { BACKUP_VERSION } from '@/persistence/backup-types'
import {
	validateBackupDocument,
	type BackupValidationResult,
} from './validate'

/**
 * Migrates a parsed backup object to the current app backup version, then validates.
 */
export function migrateBackupToCurrentVersion(
	raw: unknown,
): BackupValidationResult {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { ok: false, code: 'INVALID_STRUCTURE', detail: 'root' }
	}

	const doc = raw as Record<string, unknown>
	const version = doc.version

	if (typeof version !== 'number') {
		return { ok: false, code: 'UNSUPPORTED_VERSION' }
	}

	if (version > BACKUP_VERSION || version < 1) {
		return { ok: false, code: 'UNSUPPORTED_VERSION' }
	}

	// Future: if (version === 1) { doc = upgradeV1ToV2(doc) }
	const migrated = {
		...doc,
		version: BACKUP_VERSION,
		maintenance: Array.isArray(doc.maintenance)
			? doc.maintenance.map(normalizeMaintenanceRemind)
			: doc.maintenance,
	}

	return validateBackupDocument(migrated)
}

function normalizeMaintenanceRemind(item: unknown): unknown {
	if (typeof item !== 'object' || item === null || Array.isArray(item)) {
		return item
	}
	const record = item as Record<string, unknown>
	if (record.remind === undefined) {
		return { ...record, remind: false }
	}
	return record
}
