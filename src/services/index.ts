import { getAdService, incrementAdSessionCount } from './ads'
import { getAnalyticsService } from './analytics'

let initialized = false

/**
 * Bootstraps cross-cutting services once at app entry.
 * Analytics and ads never block journal UX.
 */
export function initializeAppServices(): void {
	if (initialized) {
		return
	}
	initialized = true

	const analytics = getAnalyticsService()
	analytics.initialize()
	analytics.track('app_open')

	void (async () => {
		try {
			await incrementAdSessionCount()
			await getAdService().initialize()
			await getAdService().preloadInterstitial('stats_open')
		} catch {
			// Fail open.
		}
	})()
}

/** Test helper — allows re-running bootstrap after replacing services. */
export function resetAppServicesInitializationForTests(): void {
	initialized = false
}

export { getAdService, setAdService } from './ads'
export { getAnalyticsService, setAnalyticsService } from './analytics'
export type { AdService, AdShowResult } from './ads'
export type { AnalyticsEventName, AnalyticsService } from './analytics'
