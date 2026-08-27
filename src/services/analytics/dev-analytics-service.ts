import { env } from '@/config/env'
import type {
	AnalyticsEventMap,
	AnalyticsEventName,
	AnalyticsScreenName,
} from './event-taxonomy'
import type { AnalyticsService } from './types'

/** Development analytics — console only, never contacts AppMetrica. */
export class DevAnalyticsService implements AnalyticsService {
	private enabled = true

	initialize(): void {}

	track<Name extends AnalyticsEventName>(
		name: Name,
		...args: AnalyticsEventMap[Name] extends undefined
			? []
			: [params: AnalyticsEventMap[Name]]
	): void {
		if (!this.enabled || !env.analyticsDevMode) {
			return
		}
		console.info('[Analytics:dev]', name, args[0] ?? {})
	}

	screen(name: AnalyticsScreenName): void {
		if (!this.enabled || !env.analyticsDevMode) {
			return
		}
		console.info('[Analytics:dev:screen]', name)
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled
	}
}
