import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contactPattern, markSvg } from '../lib/marks.mjs'

test('a contact pattern is symmetric, its diagonal the strongest of its row', () => {
  for (const cells of [4, 6, 7, 8, 9, 12, 16]) {
    const { n, value, block } = contactPattern({ name: `project-${cells}`, cells })
    assert.equal(n, cells)
    assert.equal(block.length, n)
    for (let i = 0; i < n; i++) {
      assert.equal(value[i][i], 1)
      for (let j = 0; j < n; j++) {
        assert.equal(value[i][j], value[j][i])
        assert.ok(value[i][j] <= 1)
      }
    }
  }
})

test('every block is at least two cells wide', () => {
  for (let k = 0; k < 200; k++) {
    const { block } = contactPattern({ name: `name-${k}`, cells: 4 + (k % 13) })
    const sizes = new Map()
    for (const b of block) sizes.set(b, (sizes.get(b) ?? 0) + 1)
    for (const size of sizes.values()) assert.ok(size >= 2)
  }
})

test('the same name draws the same mark; another name, another', () => {
  assert.equal(markSvg({ name: 'hicool' }), markSvg({ name: 'hicool' }))
  assert.notEqual(markSvg({ name: 'hicool' }), markSvg({ name: 'metacooler' }))
})

test('a mark is one SVG document with a title', () => {
  const svg = markSvg({ name: 'a <b> & c', style: 'ember' })
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32"/)
  assert.ok(svg.includes('<title>a &lt;b&gt; &amp; c</title>'))
  assert.equal(svg.match(/<svg/g).length, 1)
})
