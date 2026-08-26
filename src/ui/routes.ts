import type { Href } from 'expo-router'

/**
 * Cast app routes to Expo Router Href.
 * Typed route generation is optional; this keeps navigation type-safe enough
 * without requiring a fresh `expo start` types emit on every new screen.
 */
export function route(path: string): Href {
	return path as Href
}
