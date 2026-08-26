import { parseOdometerKm } from '@/units/parse-odometer-input'

describe('strict odometer parsing', () => {
	it('accepts plain integer 10000', () => {
		expect(parseOdometerKm('10000')).toEqual({ ok: true, valueKm: 10000 })
	})

	it('accepts spaced thousands 10 000', () => {
		expect(parseOdometerKm('10 000')).toEqual({ ok: true, valueKm: 10000 })
	})

	it('rejects suffix junk 10000abc', () => {
		expect(parseOdometerKm('10000abc')).toEqual({
			ok: false,
			code: 'INVALID_FORMAT',
		})
	})

	it('rejects decimal point 10000.5', () => {
		expect(parseOdometerKm('10000.5')).toEqual({
			ok: false,
			code: 'INVALID_FORMAT',
		})
	})

	it('rejects decimal comma 10000,5', () => {
		expect(parseOdometerKm('10000,5')).toEqual({
			ok: false,
			code: 'INVALID_FORMAT',
		})
	})

	it('rejects empty and whitespace-only', () => {
		expect(parseOdometerKm('')).toEqual({ ok: false, code: 'EMPTY' })
		expect(parseOdometerKm('   ')).toEqual({ ok: false, code: 'EMPTY' })
	})
})
