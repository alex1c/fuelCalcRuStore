export interface FuelEntry {
	id: string
	vehicleId: string
	/** Fill date/time — ISO-8601. */
	recordedAt: string
	odometerKm: number
	/** Canonical volume in milliliters. */
	litersMl: number
	/** Canonical money paid in kopecks. */
	totalCostKopecks: number
	/** Display/consistency field — produced by rounding helpers. */
	pricePerLiterKopecks: number
	fullTank: boolean
	note?: string
	createdAt: string
	updatedAt: string
}

/** User intends mode A: liters + price → total. */
export interface FuelMoneyInputModeA {
	mode: 'liters_and_price'
	liters: number
	pricePerLiter: number
}

/** User intends mode B: liters + total → price. */
export interface FuelMoneyInputModeB {
	mode: 'liters_and_total'
	liters: number
	totalCost: number
}

export type FuelMoneyInput = FuelMoneyInputModeA | FuelMoneyInputModeB

export interface ResolvedFuelMoney {
	litersMl: number
	totalCostKopecks: number
	pricePerLiterKopecks: number
}
