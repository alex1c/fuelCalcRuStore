import type { FuelType } from '@/domain/shared/types'

export interface Vehicle {
	id: string
	displayName: string
	make?: string
	model?: string
	fuelType: FuelType
	currentOdometerKm: number
	createdAt: string
	updatedAt: string
}
