import { describe, expect, it } from 'vitest'

import { createLoadGuard, useLoadGuard } from '@personal/shared/stores/loadGuard'
import { renderHook } from '@testing-library/react'

type Deferred = { promise: Promise<void>; resolve: () => void }

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('createLoadGuard', () => {
  it('rejects the response of the first load when a second load already started', async () => {
    const guard = createLoadGuard()
    const applied: number[] = []

    const load = (requestId: number, gate: Deferred) =>
      gate.promise.then(() => {
        if (guard.isLatest(requestId)) applied.push(requestId)
      })

    const firstGate = deferred()
    const secondGate = deferred()

    const first = load(guard.nextRequestId(), firstGate)
    const second = load(guard.nextRequestId(), secondGate)

    secondGate.resolve()
    firstGate.resolve()

    await Promise.all([first, second])

    expect(applied).toEqual([2])
  })

  it('applies responses when loads never interleave', async () => {
    const guard = createLoadGuard()
    const applied: number[] = []

    const load = (requestId: number, gate: Deferred) =>
      gate.promise.then(() => {
        if (guard.isLatest(requestId)) applied.push(requestId)
      })

    const firstGate = deferred()
    const first = load(guard.nextRequestId(), firstGate)
    firstGate.resolve()
    await first

    const secondGate = deferred()
    const second = load(guard.nextRequestId(), secondGate)
    secondGate.resolve()
    await second

    expect(applied).toEqual([1, 2])
  })

  it('hands out ever-increasing request ids', () => {
    const guard = createLoadGuard()
    const first = guard.nextRequestId()
    const second = guard.nextRequestId()
    expect(second).toBeGreaterThan(first)
  })
})

describe('useLoadGuard', () => {
  it('returns a stable guard across renders', () => {
    const { result, rerender } = renderHook(() => useLoadGuard())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(typeof first.nextRequestId).toBe('function')
    expect(typeof first.isLatest).toBe('function')
  })
})
