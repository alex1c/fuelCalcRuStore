/**
 * Process-wide serial queue for SQLite work.
 * Kept free of expo-sqlite so unit tests can import it under Jest.
 */

let operationQueue: Promise<unknown> = Promise.resolve()

/**
 * Serializes async work so callers never overlap.
 * A failed operation does not block later ones.
 */
export function enqueueDbOperation<T>(operation: () => Promise<T>): Promise<T> {
	const run = operationQueue.then(operation, operation)
	operationQueue = run.then(
		() => undefined,
		() => undefined,
	)
	return run
}

/** Test helper — clears the queue between isolated runs. */
export function resetDbOperationQueue(): void {
	operationQueue = Promise.resolve()
}
