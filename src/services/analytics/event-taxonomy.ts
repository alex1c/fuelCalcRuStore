/**
 * Privacy-first product analytics taxonomy for Auto Journal.
 *
 * Events describe actions only — never notes, vehicle names, odometer,
 * amounts, backup content, paths, or free text from the user.
 */

export type AnalyticsScreenName =
	| 'home'
	| 'history'
	| 'maintenance'
	| 'statistics'
	| 'settings'
	| 'trip_calculator'
	| 'fuel_form'
	| 'expense_form'
	| 'maintenance_form'

export type ModeAnalyticsValue = 'journal'

export type AdPlacementAnalyticsValue =
	| 'shell_banner'
	| 'stats_open'

export type AdFormatAnalyticsValue = 'banner' | 'interstitial'
export type AdErrorCategoryAnalyticsValue =
	| 'load'
	| 'show'
	| 'sdk'
	| 'unavailable'
	| 'policy'

export type FuelTankAnalyticsValue = 'full' | 'partial'
export type FuelMoneyModeAnalyticsValue = 'liters_price' | 'liters_total'
export type CsvExportKindAnalyticsValue = 'fuel' | 'expenses'

export interface AnalyticsEventMap {
	app_open: undefined

	vehicle_created: undefined
	vehicle_switched: undefined

	fuel_entry_created: {
		tank: FuelTankAnalyticsValue
		money_mode: FuelMoneyModeAnalyticsValue
	}
	fuel_entry_edited: {
		tank: FuelTankAnalyticsValue
		money_mode: FuelMoneyModeAnalyticsValue
	}
	fuel_entry_deleted: undefined

	expense_created: {
		category: string
	}

	maintenance_created: undefined
	maintenance_completed: undefined
	maintenance_reminder_enabled: undefined

	backup_created: undefined
	backup_restore_started: undefined
	backup_restore_success: undefined
	backup_restore_failed: undefined

	csv_exported: {
		kind: CsvExportKindAnalyticsValue
	}
	report_shared: undefined

	statistics_opened: undefined
	trip_calculator_opened: undefined

	ad_banner_load_requested: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
	}
	ad_banner_loaded: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
	}
	ad_banner_failed: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
		error_category: AdErrorCategoryAnalyticsValue
	}
	ad_banner_impression: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
	}
	ad_interstitial_requested: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
	}
	ad_interstitial_shown: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
	}
	ad_interstitial_skipped: {
		placement: AdPlacementAnalyticsValue
		format: AdFormatAnalyticsValue
		mode: ModeAnalyticsValue
		error_category: AdErrorCategoryAnalyticsValue
	}
}

export type AnalyticsEventName = keyof AnalyticsEventMap

export type AnalyticsParams = AnalyticsEventMap[AnalyticsEventName]
