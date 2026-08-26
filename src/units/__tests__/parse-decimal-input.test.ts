import {
	normalizeDecimalInput,
	parseUserDecimalNumber,
} from '@/units/parse-decimal-input'

describe('decimal input normalization', () => {
	it('accepts dot decimal 8.5', () => {
		expect(parseUserDecimalNumber('8.5')).toEqual({ ok: true, value: 8.5 })
	})

	it('accepts comma decimal 8,5', () => {
		expect(parseUserDecimalNumber('8,5')).toEqual({ ok: true, value: 8.5 })
	})

	it('trims leading and trailing spaces', () => {
		expect(parseUserDecimalNumber('  12,25  ')).toEqual({ ok: true, value: 12.25 })
	})

	it('rejects empty string', () => {
		expect(parseUserDecimalNumber('')).toEqual({ ok: false, code: 'EMPTY' })
		expect(parseUserDecimalNumber('   ')).toEqual({ ok: false, code: 'EMPTY' })
	})

	it('rejects invalid strings and incomplete drafts', () => {
		expect(parseUserDecimalNumber('abc')).toEqual({ ok: false, code: 'INVALID_FORMAT' })
		expect(parseUserDecimalNumber('8,')).toEqual({ ok: false, code: 'INVALID_FORMAT' })
		expect(parseUserDecimalNumber('8.5.1')).toEqual({ ok: false, code: 'INVALID_FORMAT' })
	})

	it('normalizeDecimalInput maps comma to dot', () => {
		expect(normalizeDecimalInput(' 8,5 ')).toBe('8.5')
	})
})
