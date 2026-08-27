import type {
	AnalyticsEventMap,
	AnalyticsEventName,
	AnalyticsScreenName,
} from './event-taxonomy'
import type { AnalyticsService } from './types'

/** Silent analytics provider for Jest and disabled modes. */
export class NoopAnalyticsService implements AnalyticsService {
	initialize(): void {}

	track<Name extends AnalyticsEventName>(
		_name: Name,
		..._args: AnalyticsEventMap[Name] extends undefined
			? []
			: [params: AnalyticsEventMap[Name]]
	): void {}

	screen(_name: AnalyticsScreenName): void {}

	setEnabled(_enabled: boolean): void {}
}
