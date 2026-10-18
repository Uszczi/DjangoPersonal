import { describe, expect, test } from 'vitest'

import {
  addElement,
  canRedo,
  canUndo,
  commit,
  createEmptyBoard,
  createHistory,
  moveElement,
  parseBoard,
  redo,
  removeElement,
  resizeElement,
  serializeBoard,
  setViewport,
  undo,
  updateElement,
} from '@/whiteboard/boardDocument'

describe('boardDocument', () => {
  test('createEmptyBoard returns empty document', () => {
    const doc = createEmptyBoard()
    expect(doc.version).toBe(1)
    expect(doc.elements).toEqual([])
    expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  test('addElement appends element', () => {
    const doc = createEmptyBoard()
    const next = addElement(doc, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    expect(next.elements).toHaveLength(1)
    expect(next.elements[0].id).toBe('a')
    expect(doc.elements).toHaveLength(0)
  })

  test('removeElement removes by id', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    doc = addElement(doc, { id: 'b', kind: 'text', x: 3, y: 4, text: 'ho', color: '#000' })
    const next = removeElement(doc, 'a')
    expect(next.elements.map((e) => e.id)).toEqual(['b'])
  })

  test('moveElement moves a text element', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    const next = moveElement(doc, 'a', 5, -3)
    const el = next.elements[0] as { x: number; y: number }
    expect(el.x).toBe(6)
    expect(el.y).toBe(-1)
  })

  test('moveElement moves a stroke', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 's', kind: 'stroke', points: [[0, 0], [10, 10]], color: '#000', width: 2 })
    const next = moveElement(doc, 's', 5, 5)
    const el = next.elements[0] as { points: [number, number][] }
    expect(el.points).toEqual([[5, 5], [15, 15]])
  })

  test('resizeElement resizes a rectangle', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'r', kind: 'rectangle', x: 0, y: 0, width: 10, height: 10, color: '#000' })
    const next = resizeElement(doc, 'r', 20, 30)
    const el = next.elements[0] as { width: number; height: number }
    expect(el.width).toBe(20)
    expect(el.height).toBe(30)
  })

  test('setViewport updates viewport', () => {
    const doc = createEmptyBoard()
    const next = setViewport(doc, { x: 10, y: 20, zoom: 2 })
    expect(next.viewport).toEqual({ x: 10, y: 20, zoom: 2 })
  })

  test('serialize/parse round trips', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    doc = setViewport(doc, { x: 5, y: 6, zoom: 1.5 })
    const parsed = parseBoard(JSON.parse(serializeBoard(doc)))
    expect(parsed).toEqual(doc)
  })

  test('parseBoard falls back to empty for invalid', () => {
    expect(parseBoard(null).elements).toEqual([])
    expect(parseBoard({ foo: 1 }).elements).toEqual([])
  })

  test('undo/redo history', () => {
    const doc0 = createEmptyBoard()
    const h0 = createHistory(doc0)
    const doc1 = addElement(doc0, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    const h1 = commit(h0, doc1)
    expect(canUndo(h1)).toBe(true)
    expect(canRedo(h1)).toBe(false)
    const h2 = undo(h1)
    expect(h2.present).toEqual(doc0)
    expect(canRedo(h2)).toBe(true)
    const h3 = redo(h2)
    expect(h3.present).toEqual(doc1)
  })

  test('commit clears future', () => {
    const doc0 = createEmptyBoard()
    const h0 = createHistory(doc0)
    const doc1 = addElement(doc0, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    const h1 = commit(h0, doc1)
    const h2 = undo(h1)
    const doc2 = addElement(doc0, { id: 'b', kind: 'text', x: 3, y: 4, text: 'ho', color: '#000' })
    const h3 = commit(h2, doc2)
    expect(canRedo(h3)).toBe(false)
  })

  test('updateElement patches fields', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'a', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    const next = updateElement(doc, 'a', { text: 'bye' } as any)
    expect((next.elements[0] as { text: string }).text).toBe('bye')
  })

  test('note can be added, moved and resized', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'n', kind: 'note', x: 10, y: 20, width: 100, height: 80, text: 'hi', color: '#fef3c7' })
    expect(doc.elements).toHaveLength(1)
    const moved = moveElement(doc, 'n', 5, 5)
    const ne = moved.elements[0] as { x: number; y: number }
    expect(ne.x).toBe(15)
    expect(ne.y).toBe(25)
    const resized = resizeElement(doc, 'n', 200, 160)
    const re = resized.elements[0] as { width: number; height: number }
    expect(re.width).toBe(200)
    expect(re.height).toBe(160)
  })

  test('label text can be updated', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 't', kind: 'text', x: 1, y: 2, text: 'hi', color: '#000' })
    const next = updateElement(doc, 't', { text: 'hello world' } as any)
    expect((next.elements[0] as { text: string }).text).toBe('hello world')
  })

  test('line and arrow can be moved', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'l', kind: 'line', from: [0, 0], to: [10, 10], color: '#000' })
    doc = addElement(doc, { id: 'a', kind: 'arrow', from: [5, 5], to: [15, 15], color: '#000' })
    const moved = moveElement(doc, 'l', 3, 4)
    const le = moved.elements[0] as { from: [number, number]; to: [number, number] }
    expect(le.from).toEqual([3, 4])
    expect(le.to).toEqual([13, 14])
    const moved2 = moveElement(doc, 'a', 1, 1)
    const ae = moved2.elements[1] as { from: [number, number]; to: [number, number] }
    expect(ae.from).toEqual([6, 6])
    expect(ae.to).toEqual([16, 16])
  })

  test('rectangle and ellipse can be resized', () => {
    let doc = createEmptyBoard()
    doc = addElement(doc, { id: 'r', kind: 'rectangle', x: 0, y: 0, width: 10, height: 10, color: '#000' })
    doc = addElement(doc, { id: 'e', kind: 'ellipse', x: 0, y: 0, width: 10, height: 10, color: '#000' })
    const resized = resizeElement(resizeElement(doc, 'r', 20, 30), 'e', 40, 50)
    const re = resized.elements[0] as { width: number; height: number }
    const ee = resized.elements[1] as { width: number; height: number }
    expect(re.width).toBe(20)
    expect(re.height).toBe(30)
    expect(ee.width).toBe(40)
    expect(ee.height).toBe(50)
  })
})