import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutosave } from '@/whiteboard/useAutosave'

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces scheduled saves by 500 ms by default', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'first' })
    })
    await act(async () => {
      vi.advanceTimersByTime(499)
    })
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'markdown', markdown: 'first' })
  })

  it('respects a custom delay option', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save, { delay: 100 }))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'x' })
    })

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('keeps only the latest payload across debounced saves', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'a' })
      result.current.schedule({ kind: 'markdown', markdown: 'b' })
      result.current.schedule({ kind: 'whiteboard', doc: {} as never })
    })

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'whiteboard', doc: {} })
  })

  it('flush saves the latest payload immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'a' })
      result.current.schedule({ kind: 'markdown', markdown: 'b' })
    })

    await act(async () => {
      await result.current.flush()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'markdown', markdown: 'b' })
  })

  it('moves saved -> saving -> saved around a successful save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save))

    expect(result.current.saveState).toBe('saved')

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'x' })
    })
    expect(result.current.saveState).toBe('saving')

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })
    expect(result.current.saveState).toBe('saved')
  })

  it('marks saving -> failed when the save rejects', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'x' })
    })
    expect(result.current.saveState).toBe('saving')

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })
    expect(result.current.saveState).toBe('failed')
  })

  it('saveNow writes immediately without debounce', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.saveNow({ kind: 'name', name: 'Nowa nazwa' })
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'name', name: 'Nowa nazwa' })

    await act(async () => {})
    expect(result.current.saveState).toBe('saved')
  })

  it('flushes a pending document save on unmount', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useAutosave(save))

    act(() => {
      result.current.schedule({ kind: 'markdown', markdown: 'draft' })
    })
    expect(save).not.toHaveBeenCalled()

    unmount()

    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'markdown', markdown: 'draft' })
  })
})
