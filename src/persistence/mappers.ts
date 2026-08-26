import type { Expense } from '@/domain/expenses/types'
import type { FuelEntry } from '@/domain/fuel/types'
import type { MaintenanceItem } from '@/domain/maintenance/types'
import type { ExpenseCategory, FuelType } from '@/domain/shared/types'
import type { Vehicle } from '@/domain/vehicle/types'

export interface VehicleRow {
	id: string
	display_name: string
	make: string | null
	model: string | null
	fuel_type: string
	current_odometer_km: number
	created_at: string
	updated_at: string
}

export interface FuelEntryRow {
	id: string
	vehicle_id: string
	recorded_at: string
	odometer_km: number
	liters_ml: number
	total_cost_kopecks: number
	price_per_liter_kopecks: number
	full_tank: number
	note: string | null
	created_at: string
	updated_at: string
}

export interface ExpenseRow {
	id: string
	vehicle_id: string
	recorded_at: string
	odometer_km: number | null
	amount_kopecks: number
	category: string
	note: string | null
	created_at: string
	updated_at: string
}

export interface MaintenanceRow {
	id: string
	vehicle_id: string
	title: string
	last_service_date: string | null
	last_service_odometer_km: number | null
	interval_km: number | null
	interval_days: number | null
	note: string | null
	active: number
	remind: number | null
	created_at: string
	updated_at: string
}

export function mapVehicleRow(row: VehicleRow): Vehicle {
	return {
		id: row.id,
		displayName: row.display_name,
		make: row.make ?? undefined,
		model: row.model ?? undefined,
		fuelType: row.fuel_type as FuelType,
		currentOdometerKm: row.current_odometer_km,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export function mapFuelEntryRow(row: FuelEntryRow): FuelEntry {
	return {
		id: row.id,
		vehicleId: row.vehicle_id,
		recordedAt: row.recorded_at,
		odometerKm: row.odometer_km,
		litersMl: row.liters_ml,
		totalCostKopecks: row.total_cost_kopecks,
		pricePerLiterKopecks: row.price_per_liter_kopecks,
		fullTank: row.full_tank === 1,
		note: row.note ?? undefined,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export function mapExpenseRow(row: ExpenseRow): Expense {
	return {
		id: row.id,
		vehicleId: row.vehicle_id,
		recordedAt: row.recorded_at,
		odometerKm: row.odometer_km ?? undefined,
		amountKopecks: row.amount_kopecks,
		category: row.category as ExpenseCategory,
		note: row.note ?? undefined,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export function mapMaintenanceRow(row: MaintenanceRow): MaintenanceItem {
	return {
		id: row.id,
		vehicleId: row.vehicle_id,
		title: row.title,
		lastServiceDate: row.last_service_date ?? undefined,
		lastServiceOdometerKm: row.last_service_odometer_km ?? undefined,
		intervalKm: row.interval_km ?? undefined,
		intervalDays: row.interval_days ?? undefined,
		note: row.note ?? undefined,
		active: row.active === 1,
		remind: (row.remind ?? 0) === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}
