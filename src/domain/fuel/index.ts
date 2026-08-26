export type { FuelEntry, FuelMoneyInput, ResolvedFuelMoney } from './types'
export { resolveFuelMoney } from './resolve-money'
export {
	compareFuelEntries,
	compareFuelEntriesByTime,
	filterFuelEntriesByVehicle,
	sortFuelEntries,
	validateFuelOdometer,
} from './validate'
export {
	averageConsumptionForPeriod,
	calculateConsumption,
	type AverageConsumptionForPeriod,
	type ConsumptionInterval,
	type ConsumptionStatus,
} from './consumption'
