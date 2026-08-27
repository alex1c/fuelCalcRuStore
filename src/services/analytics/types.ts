import type {
	AnalyticsEventMap,
	AnalyticsEventName,
	AnalyticsScreenName,
} from './event-taxonomy'

/** Provider-independent analytics boundary — UI never imports AppMetrica. */
export interface AnalyticsService {
	initialize(): void
	track<Name extends AnalyticsEventName>(
		name: Name,
		...args: AnalyticsEventMap[Name] extends undefined
			? []
			: [params: AnalyticsEventMap[Name]]
	): void
	screen(name: AnalyticsScreenName): void
	setEnabled(enabled: boolean): void
}
