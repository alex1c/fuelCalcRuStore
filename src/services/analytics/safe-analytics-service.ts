import type {
	AnalyticsEventMap,
	AnalyticsEventName,
	AnalyticsScreenName,
} from './event-taxonomy'
import type { AnalyticsService } from './types'

/** Fail-open wrapper so analytics never blocks journal actions. */
export class SafeAnalyticsService implements AnalyticsService {
	constructor(private readonly inner: AnalyticsService) {}

	initialize(): void {
		try {
			this.inner.initialize()
		} catch {
			// Analytics must never block startup.
		}
	}

	track<Name extends AnalyticsEventName>(
		name: Name,
		...args: AnalyticsEventMap[Name] extends undefined
			? []
			: [params: AnalyticsEventMap[Name]]
	): void {
		try {
			;(this.inner.track as (
				eventName: Name,
				...eventArgs: AnalyticsEventMap[Name] extends undefined
					? []
					: [params: AnalyticsEventMap[Name]]
			) => void)(name, ...args)
		} catch {
			// Swallow provider errors.
		}
	}

	screen(name: AnalyticsScreenName): void {
		try {
			this.inner.screen(name)
		} catch {
			// Swallow provider errors.
		}
	}

	setEnabled(enabled: boolean): void {
		try {
			this.inner.setEnabled(enabled)
		} catch {
			// Swallow provider errors.
		}
	}
}
