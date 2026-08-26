import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import type { Expense } from '@/domain/expenses/types'
import type { FuelEntry } from '@/domain/fuel/types'
import type { MaintenanceItem } from '@/domain/maintenance/types'
import type { Vehicle } from '@/domain/vehicle/types'
import {
	getActiveVehicleId,
	listExpenses,
	listFuelEntries,
	listMaintenance,
	listVehicles,
	setActiveVehicleId,
} from '@/persistence'

interface JournalContextValue {
	isReady: boolean
	error: string | null
	vehicles: Vehicle[]
	fuelEntries: FuelEntry[]
	expenses: Expense[]
	maintenance: MaintenanceItem[]
	activeVehicleId: string | undefined
	activeVehicle: Vehicle | undefined
	activeFuelEntries: FuelEntry[]
	activeExpenses: Expense[]
	activeMaintenance: MaintenanceItem[]
	refresh: () => Promise<void>
	selectVehicle: (vehicleId: string) => Promise<void>
}

const JournalContext = createContext<JournalContextValue | null>(null)

/** Loads SQLite journal data and keeps the active vehicle selection. */
export function JournalProvider({ children }: { children: ReactNode }) {
	const [isReady, setIsReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [vehicles, setVehicles] = useState<Vehicle[]>([])
	const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([])
	const [expenses, setExpenses] = useState<Expense[]>([])
	const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([])
	const [activeVehicleId, setActiveId] = useState<string | undefined>()

	const refresh = useCallback(async () => {
		try {
			const [nextVehicles, nextFuel, nextExpenses, nextMaintenance, storedActiveId] =
				await Promise.all([
					listVehicles(),
					listFuelEntries(),
					listExpenses(),
					listMaintenance(),
					getActiveVehicleId(),
				])

			let nextActive = storedActiveId
			if (nextActive && !nextVehicles.some((v) => v.id === nextActive)) {
				nextActive = undefined
			}
			if (!nextActive && nextVehicles.length > 0) {
				nextActive = nextVehicles[0].id
				await setActiveVehicleId(nextActive)
			}

			setVehicles(nextVehicles)
			setFuelEntries(nextFuel)
			setExpenses(nextExpenses)
			setMaintenance(nextMaintenance)
			setActiveId(nextActive)
			setError(null)
			setIsReady(true)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Database error'
			setError(message)
			setIsReady(true)
		}
	}, [])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const selectVehicle = useCallback(async (vehicleId: string) => {
		await setActiveVehicleId(vehicleId)
		setActiveId(vehicleId)
	}, [])

	const activeVehicle = useMemo(
		() => vehicles.find((vehicle) => vehicle.id === activeVehicleId),
		[vehicles, activeVehicleId],
	)

	const activeFuelEntries = useMemo(
		() =>
			activeVehicleId
				? fuelEntries.filter((entry) => entry.vehicleId === activeVehicleId)
				: [],
		[fuelEntries, activeVehicleId],
	)

	const activeExpenses = useMemo(
		() =>
			activeVehicleId
				? expenses.filter((expense) => expense.vehicleId === activeVehicleId)
				: [],
		[expenses, activeVehicleId],
	)

	const activeMaintenance = useMemo(
		() =>
			activeVehicleId
				? maintenance.filter((item) => item.vehicleId === activeVehicleId)
				: [],
		[maintenance, activeVehicleId],
	)

	const value = useMemo(
		() => ({
			isReady,
			error,
			vehicles,
			fuelEntries,
			expenses,
			maintenance,
			activeVehicleId,
			activeVehicle,
			activeFuelEntries,
			activeExpenses,
			activeMaintenance,
			refresh,
			selectVehicle,
		}),
		[
			isReady,
			error,
			vehicles,
			fuelEntries,
			expenses,
			maintenance,
			activeVehicleId,
			activeVehicle,
			activeFuelEntries,
			activeExpenses,
			activeMaintenance,
			refresh,
			selectVehicle,
		],
	)

	return (
		<JournalContext.Provider value={value}>{children}</JournalContext.Provider>
	)
}

export function useJournal(): JournalContextValue {
	const ctx = useContext(JournalContext)
	if (!ctx) {
		throw new Error('useJournal must be used within JournalProvider')
	}
	return ctx
}
