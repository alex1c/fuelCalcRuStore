/**
 * Generates a UUID-like id for local entities.
 * Uses crypto.randomUUID when available (Hermes / modern runtimes).
 */
export function createId(): string {
	const cryptoApi = globalThis.crypto as Crypto | undefined

	if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
		return cryptoApi.randomUUID()
	}

	// Fallback for environments without randomUUID.
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
