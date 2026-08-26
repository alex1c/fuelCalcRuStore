/**
 * RU Excel-friendly CSV: UTF-8 BOM, semicolon delimiter, escaped fields.
 */

const UTF8_BOM = '\uFEFF'
const DELIMITER = ';'

/** Escapes a CSV field for semicolon-separated values. */
export function escapeCsvField(value: string): string {
	const needsQuotes =
		value.includes(DELIMITER) ||
		value.includes('"') ||
		value.includes('\n') ||
		value.includes('\r')

	const escaped = value.replace(/"/g, '""')
	return needsQuotes ? `"${escaped}"` : escaped
}

/** Builds a CSV document with BOM + header + rows. */
export function buildCsvDocument(
	headers: string[],
	rows: string[][],
): string {
	const lines = [
		headers.map(escapeCsvField).join(DELIMITER),
		...rows.map((row) => row.map(escapeCsvField).join(DELIMITER)),
	]
	return `${UTF8_BOM}${lines.join('\r\n')}\r\n`
}

export function csvFileName(kind: 'fuel' | 'expenses', date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	return `auto-journal-${kind}-${day}.csv`
}

export interface FuelCsvRowInput {
	vehicleName: string
	recordedAt: string
	odometerKm: number
	liters: number
	pricePerLiter: number
	total: number
	fullTank: boolean
	note?: string
}

export function serializeFuelCsv(rows: FuelCsvRowInput[]): string {
	return buildCsvDocument(
		[
			'Автомобиль',
			'Дата',
			'Пробег',
			'Литры',
			'Цена за литр',
			'Сумма',
			'Полный бак',
			'Заметка',
		],
		rows.map((row) => [
			row.vehicleName,
			row.recordedAt,
			String(row.odometerKm),
			formatDecimal(row.liters),
			formatDecimal(row.pricePerLiter),
			formatDecimal(row.total),
			row.fullTank ? 'да' : 'нет',
			row.note ?? '',
		]),
	)
}

export interface ExpenseCsvRowInput {
	vehicleName: string
	recordedAt: string
	category: string
	amount: number
	odometerKm?: number
	note?: string
}

export function serializeExpensesCsv(rows: ExpenseCsvRowInput[]): string {
	return buildCsvDocument(
		['Автомобиль', 'Дата', 'Категория', 'Сумма', 'Пробег', 'Заметка'],
		rows.map((row) => [
			row.vehicleName,
			row.recordedAt,
			row.category,
			formatDecimal(row.amount),
			row.odometerKm !== undefined ? String(row.odometerKm) : '',
			row.note ?? '',
		]),
	)
}

function formatDecimal(value: number): string {
	return value.toFixed(2).replace('.', ',')
}
