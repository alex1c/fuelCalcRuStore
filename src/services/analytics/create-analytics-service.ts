import { env } from '@/config/env'
import { AppMetricaAnalyticsService } from './appmetrica-analytics-service'
import { DevAnalyticsService } from './dev-analytics-service'
import { NoopAnalyticsService } from './noop-analytics-service'
import { SafeAnalyticsService } from './safe-analytics-service'
import type { AnalyticsService } from './types'

const PLACEHOLDER_API_KEY = 'your-dev-appmetrica-key'

function isJestRuntime(): boolean {
	return typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined
}

function hasConfiguredAppMetricaKey(apiKey: string): boolean {
	const trimmed = apiKey.trim()
	return trimmed.length > 0 && trimmed !== PLACEHOLDER_API_KEY
}

/**
 * Builds the process analytics provider.
 *
 * Priority: Jest → noop; missing key → dev logger; else AppMetrica + Safe.
 */
export function createAnalyticsService(): AnalyticsService {
	if (isJestRuntime()) {
		return new SafeAnalyticsService(new NoopAnalyticsService())
	}

	if (!hasConfiguredAppMetricaKey(env.appMetricaApiKey)) {
		return new SafeAnalyticsService(new DevAnalyticsService())
	}

	return new SafeAnalyticsService(
		new AppMetricaAnalyticsService(env.appMetricaApiKey),
	)
}

export { hasConfiguredAppMetricaKey, PLACEHOLDER_API_KEY }
