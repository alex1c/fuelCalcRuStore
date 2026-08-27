import { createAnalyticsService } from './create-analytics-service'
import type { AnalyticsService } from './types'

let analyticsService: AnalyticsService = createAnalyticsService()

/** Returns the process-wide analytics service instance. */
export function getAnalyticsService(): AnalyticsService {
	return analyticsService
}

/** Allows tests to replace the analytics provider. */
export function setAnalyticsService(service: AnalyticsService): void {
	analyticsService = service
}

export type { AnalyticsService } from './types'
export type {
	AdErrorCategoryAnalyticsValue,
	AdFormatAnalyticsValue,
	AdPlacementAnalyticsValue,
	AnalyticsEventMap,
	AnalyticsEventName,
	AnalyticsScreenName,
	CsvExportKindAnalyticsValue,
	FuelMoneyModeAnalyticsValue,
	FuelTankAnalyticsValue,
	ModeAnalyticsValue,
} from './event-taxonomy'

export { AppMetricaAnalyticsService } from './appmetrica-analytics-service'
export { DevAnalyticsService } from './dev-analytics-service'
export { NoopAnalyticsService } from './noop-analytics-service'
export { SafeAnalyticsService } from './safe-analytics-service'
export {
	createAnalyticsService,
	hasConfiguredAppMetricaKey,
	PLACEHOLDER_API_KEY,
} from './create-analytics-service'
