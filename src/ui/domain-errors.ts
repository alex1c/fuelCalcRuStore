import type { DomainErrorCode } from '@/domain/shared/result'

/** Maps domain error codes to short Russian UI copy. */
export function describeDomainError(
	code: DomainErrorCode,
	field?: string,
): string {
	switch (code) {
		case 'EMPTY':
			return 'Заполните поле'
		case 'INVALID_FORMAT':
			return 'Некорректный формат'
		case 'NOT_POSITIVE':
			return 'Значение должно быть больше нуля'
		case 'NEGATIVE':
			return 'Отрицательное значение недопустимо'
		case 'TOO_LARGE':
			return 'Слишком большое значение'
		case 'TOO_SMALL':
			return 'Слишком маленькое значение'
		case 'ODOMETER_DECREASING':
			return 'Пробег меньше соседней записи по дате'
		case 'ODOMETER_NOT_INCREASING':
			return 'Пробег должен быть больше соседней записи'
		case 'FUEL_EXPENSE_NOT_ALLOWED':
			return 'Топливо учитывается через заправки'
		case 'MISSING_FIELD':
			return field ? `Не заполнено: ${field}` : 'Не заполнено обязательное поле'
		case 'INSUFFICIENT_DATA':
			return 'Недостаточно данных'
		case 'ZERO_DISTANCE':
			return 'Нулевая дистанция'
		default:
			return 'Проверьте введённые данные'
	}
}
