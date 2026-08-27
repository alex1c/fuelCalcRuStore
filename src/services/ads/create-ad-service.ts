import { SafeAdService } from './safe-ad-service'
import { NoopAdService } from './noop-ad-service'
import type { AdService } from './types'

function isJestRuntime(): boolean {
	return typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined
}

/**
 * Builds the process ad provider.
 * Jest → Noop; otherwise Yandex behind SafeAdService.
 */
export function createAdService(): AdService {
	if (isJestRuntime()) {
		return new SafeAdService(new NoopAdService())
	}

	// Lazy require so importing create-ad-service in Jest never loads Yandex.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { YandexAdService } = require('./yandex-ad-service') as typeof import('./yandex-ad-service')
	return new SafeAdService(new YandexAdService())
}
