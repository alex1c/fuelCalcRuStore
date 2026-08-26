import {
	buildCsvDocument,
	escapeCsvField,
	serializeExpensesCsv,
	serializeFuelCsv,
} from '@/export/csv'
import { buildShareReportText } from '@/export/share-report'
import type { Vehicle } from '@/domain/vehicle/types'
import type { FuelEntry } from '@/domain/fuel/types'
import type { Expense } from '@/domain/expenses/types'

describe('CSV serialization', () => {
	it('uses BOM, semicolon, and escapes quotes/newlines', () => {
		const csv = buildCsvDocument(
			['A', 'B'],
			[['привет', 'a;b'], ['x"y', 'line1\nline2']],
		)
		expect(csv.startsWith('\uFEFF')).toBe(true)
		expect(csv).toContain('A;B')
		expect(csv).toContain('привет')
		expect(escapeCsvField('a;b')).toBe('"a;b"')
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
		expect(csv).toContain('"line1\nline2"')
	})

	it('serializes fuel and expenses with Cyrillic headers', () => {
		const fuel = serializeFuelCsv([
			{
				vehicleName: 'Toyota',
				recordedAt: '2026-08-26T10:00:00.000Z',
				odometerKm: 10000,
				liters: 40.5,
				pricePerLiter: 56.49,
				total: 2287.85,
				fullTank: true,
				note: 'полная',
			},
		])
		expect(fuel).toContain('Автомобиль')
		expect(fuel).toContain('40,50')
		expect(fuel).toContain('да')

		const expenses = serializeExpensesCsv([
			{
				vehicleName: 'Toyota',
				recordedAt: '2026-08-26T12:00:00.000Z',
				category: 'Мойка',
				amount: 1000,
				note: 'быстро',
			},
		])
		expect(expenses).toContain('Категория')
		expect(expenses).toContain('Мойка')
		expect(expenses).toContain('1000,00')
	})
})

describe('share report formatter', () => {
	const vehicle: Vehicle = {
		id: 'v1',
		displayName: 'Toyota',
		fuelType: 'petrol95',
		currentOdometerKm: 10600,
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-26T00:00:00.000Z',
	}

	const fuel: FuelEntry[] = [
		{
			id: 'f1',
			vehicleId: 'v1',
			recordedAt: '2026-08-10T10:00:00.000Z',
			odometerKm: 10000,
			litersMl: 40_000,
			pricePerLiterKopecks: 5000,
			totalCostKopecks: 200_000,
			fullTank: true,
			createdAt: '2026-08-10T10:00:00.000Z',
			updatedAt: '2026-08-10T10:00:00.000Z',
		},
		{
			id: 'f2',
			vehicleId: 'v1',
			recordedAt: '2026-08-20T10:00:00.000Z',
			odometerKm: 10600,
			litersMl: 45_000,
			pricePerLiterKopecks: 5000,
			totalCostKopecks: 225_000,
			fullTank: true,
			createdAt: '2026-08-20T10:00:00.000Z',
			updatedAt: '2026-08-20T10:00:00.000Z',
		},
	]

	const expenses: Expense[] = [
		{
			id: 'e1',
			vehicleId: 'v1',
			category: 'washing',
			amountKopecks: 100_000,
			recordedAt: '2026-08-21T12:00:00.000Z',
			createdAt: '2026-08-21T12:00:00.000Z',
			updatedAt: '2026-08-21T12:00:00.000Z',
		},
	]

	it('includes available metrics and omits empty noise', () => {
		const text = buildShareReportText({
			vehicle,
			fuelEntries: fuel,
			expenses,
			now: new Date('2026-08-26T12:00:00.000Z'),
		})
		expect(text).toContain('Автожурнал — Toyota')
		expect(text).toContain('Средний расход:')
		expect(text).toContain('Топливо:')
		expect(text).toContain('Прочие расходы:')
		expect(text).toContain('Всего:')
	})
})
