import { createAdService } from './create-ad-service'
import type { AdService } from './types'

let adService: AdService = createAdService()

export function getAdService(): AdService {
	return adService
}

export function setAdService(service: AdService): void {
	adService = service
}
