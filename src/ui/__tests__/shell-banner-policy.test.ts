import { shouldShowShellBanner } from '@/ui/shell-banner-policy'

describe('shouldShowShellBanner', () => {
	it('shows the banner on every tab and the vehicle list', () => {
		expect(shouldShowShellBanner([])).toBe(true)
		expect(shouldShowShellBanner(['(tabs)'])).toBe(true)
		expect(shouldShowShellBanner(['(tabs)', 'history'])).toBe(true)
		expect(shouldShowShellBanner(['(tabs)', 'settings'])).toBe(true)
		expect(shouldShowShellBanner(['vehicles'])).toBe(true)
		expect(shouldShowShellBanner(['vehicles', 'index'])).toBe(true)
	})

	it('hides the banner on forms and the trip calculator', () => {
		expect(shouldShowShellBanner(['vehicles', 'edit'])).toBe(false)
		expect(shouldShowShellBanner(['fuel', 'new'])).toBe(false)
		expect(shouldShowShellBanner(['fuel', 'edit'])).toBe(false)
		expect(shouldShowShellBanner(['expenses', 'edit'])).toBe(false)
		expect(shouldShowShellBanner(['maintenance', 'edit'])).toBe(false)
		expect(shouldShowShellBanner(['trip'])).toBe(false)
	})
})
