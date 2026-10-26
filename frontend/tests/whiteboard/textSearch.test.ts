import { describe, expect, test } from 'vitest'

import { findMatches } from '@/whiteboard/textSearch'

const found = (text: string, query: string) =>
  findMatches(text, query).map(({ start, end }) => text.slice(start, end))

describe('findMatches', () => {
  test('ignores case and Polish letters, keeping offsets into the original text', () => {
    expect(found('Żółw i ŻÓŁW', 'zolw')).toEqual(['Żółw', 'ŻÓŁW'])
  })

  test('matches each word of the query on its own, in text order', () => {
    expect(found('Zadzwonić do Żanety', 'zanet zadzwon')).toEqual(['Zadzwon', 'Żanet'])
  })

  test('merges overlapping matches and finds nothing for a blank query', () => {
    expect(found('kawałek', 'kawa awal')).toEqual(['kawał'])
    expect(findMatches('cokolwiek', '   ')).toEqual([])
  })
})
