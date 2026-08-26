import type { ExpenseCategory } from '@/domain/shared/types'

export const EXPENSE_CATEGORY_LABELS: Record<
	Exclude<ExpenseCategory, 'fuel'>,
	string
> = {
	maintenance: 'ТО',
	repair: 'Ремонт',
	parts: 'Запчасти',
	insurance: 'Страховка',
	washing: 'Мойка',
	parking: 'Парковка',
	fines: 'Штрафы',
	tires: 'Шины',
	tax: 'Налог',
	other: 'Прочее',
}

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(
	EXPENSE_CATEGORY_LABELS,
) as [Exclude<ExpenseCategory, 'fuel'>, string][]

export function expenseCategoryLabel(category: ExpenseCategory): string {
	if (category === 'fuel') {
		return 'Топливо'
	}
	return EXPENSE_CATEGORY_LABELS[category] ?? category
}

export const MAINTENANCE_SUGGESTIONS = [
	'Масло двигателя',
	'Масляный фильтр',
	'Воздушный фильтр',
	'Тормозные колодки',
	'Свечи',
	'Ремень/цепь',
	'Шины',
	'ОСАГО',
	'Техосмотр',
	'Другое',
] as const

export function urgencyLabel(
	urgency: 'ok' | 'soon' | 'overdue' | 'none',
): string {
	switch (urgency) {
		case 'ok':
			return 'В норме'
		case 'soon':
			return 'Скоро'
		case 'overdue':
			return 'Просрочено'
		default:
			return 'Без графика'
	}
}
