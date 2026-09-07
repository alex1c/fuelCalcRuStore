/**
 * Regression: DB operation queue must serialize overlapping work.
 * Concurrent native prepareAsync on Android can corrupt SharedObject IDs
 * (NativeStatement cast / invalid SharedObject id).
 */

import {
	enqueueDbOperation,
	resetDbOperationQueue,
} from '../db-operation-queue'

describe('enqueueDbOperation serial queue', () => {
	beforeEach(() => {
		resetDbOperationQueue()
	})

	afterEach(() => {
		resetDbOperationQueue()
	})

	it('runs overlapping operations in start order without interleaving', async () => {
		const log: string[] = []

		const slow = enqueueDbOperation(async () => {
			log.push('a-start')
			await new Promise((resolve) => setTimeout(resolve, 30))
			log.push('a-end')
			return 'a'
		})

		const fast = enqueueDbOperation(async () => {
			log.push('b-start')
			log.push('b-end')
			return 'b'
		})

		const results = await Promise.all([slow, fast])

		expect(results).toEqual(['a', 'b'])
		expect(log).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
	})

	it('continues the queue after a failed operation', async () => {
		await expect(
			enqueueDbOperation(async () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')

		const value = await enqueueDbOperation(async () => 'recovered')
		expect(value).toBe('recovered')
	})
})
