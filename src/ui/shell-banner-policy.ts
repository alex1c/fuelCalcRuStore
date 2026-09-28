/**
 * Decides which routes keep the persistent bottom banner.
 * Form and calculator screens are excluded: a banner there competes with
 * the keyboard and the primary save/calculate action.
 */

const FORM_ROOTS = new Set([
	'fuel',
	'expenses',
	'maintenance',
	'trip',
])

/**
 * `segments` comes from expo-router useSegments().
 * Examples: ['(tabs)', 'index'], ['vehicles', 'edit'], ['fuel', 'new'].
 */
export function shouldShowShellBanner(segments: readonly string[]): boolean {
	const root = segments[0]
	const child = segments[1]

	if (!root || root === '(tabs)') {
		return true
	}

	// Vehicle list is a browsing screen. The edit form is not.
	if (root === 'vehicles') {
		return child !== 'edit'
	}

	if (FORM_ROOTS.has(root)) {
		return false
	}

	// Unknown routes stay ad-free until they are classified.
	return false
}
