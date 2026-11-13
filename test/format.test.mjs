// The cases of chromomap's test/unit/kit/units-d38.test.ts and units.test.ts
// (js2264/chromomap@2b5dfe5), against the port in src/js/format.mjs.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { durationText, fmt, NBSP, parseNumberInput, resolutionLabel, withUnit } from '../src/js/format.mjs'

const real = (text, unit) => parseNumberInput(text, { unit })
const whole = (text, unit) => parseNumberInput(text, { integer: true, unit })

test('a number never breaks from its unit', () => {
  assert.equal(fmt.bytes(18_100_000), `18.1${NBSP}MB`)
  assert.equal(fmt.bp(1_224_000), `1.22${NBSP}Mb`)
  assert.equal(withUnit(10, 'bp'), `10${NBSP}bp`)
  assert.equal(durationText(161_000), `2${NBSP}min${NBSP}41${NBSP}s`)
  assert.equal(durationText(7_500_000), `2${NBSP}h${NBSP}5${NBSP}min`)
  assert.equal(resolutionLabel(12_500), `12.5${NBSP}kb`)
  assert.equal(fmt.int(4_573_673), '4,573,673')
  assert.equal(fmt.num(0.000123456), '0.000123')
  assert.equal(fmt.pct(0.083), '8.3%')
})

for (const [text, value] of [
  ['0.05', 0.05], ['0,05', 0.05], ['1,5', 1.5], ['10', 10], ['  10  ', 10], ['+3', 3], ['-0.5', -0.5],
  ['−0,5', -0.5], ['-0', 0], ['.5', 0.5], [',5', 0.5], ['1234,567', 1234.567], ['0,050', 0.05],
  ['1,000.5', 1000.5], ['1.000,5', 1000.5], ['1.000.000,25', 1000000.25], ['12,345,678', 12345678],
  ['1.000.000', 1000000], ['1 000', 1000], ['1 000 000', 1000000], ['13e6', 13e6], ['1,5e-3', 1.5e-3],
  ['5E−2', 0.05], ['10 bp', 10], ['10BP', 10], ['5%', 5],
]) {
  test(`reads ${JSON.stringify(text)} in a real-valued field`, () => {
    const unit = text.toLowerCase().endsWith('bp') ? 'bp' : text.endsWith('%') ? '%' : undefined
    assert.deepEqual(real(text, unit), { ok: true, value })
  })
}

for (const [text, value] of [
  ['1,000', 1000], ['12,345,678', 12345678], ['1 000', 1000], ['10.0', 10], ['1e3', 1000],
  ['1.000.000', 1000000], ['-7', -7], ['11,777,273', 11777273], ['1,0', 1], ['1,2e7', 12000000], ['1,500', 1500],
]) {
  test(`reads ${JSON.stringify(text)} in an integer field`, () => {
    assert.deepEqual(whole(text), { ok: true, value })
  })
}

test('refuses a separator that reads two ways, with both readings', () => {
  const r = real('1,000')
  assert.equal(r.ok, false)
  assert.deepEqual(r.readings, [1000, 1])
  assert.equal(r.message, '"1,000" could mean 1000 (a comma grouping thousands) or 1 (a comma as the decimal point). Type 1000 or 1.')
  assert.deepEqual(real('-12,345e1').readings, [-123450, -123.45])
  assert.deepEqual(whole('1.000').readings, [1, 1000])
  assert.deepEqual(real('1.000'), { ok: true, value: 1 })
})

for (const [text, message] of [
  ['', 'Nothing is typed. Type a number.'], ['bp', 'Nothing is typed. Type a number.'], ['abc', 'is not a number'],
  ['1e', 'is not a number'], ['e5', 'is not a number'], ['1.', 'is not a number'], ['1,,000', 'is not a number'],
  ['- 5', 'is not a number'], ['1.000.000.5,5', 'grouped unevenly'], ['1,000.000.5', 'is not a number'],
  ['1.000,000,5', 'is not a number'], ['0.12 345', 'is not a number'], ['1,00,000', 'grouped unevenly'],
  ['12 34', 'grouped unevenly'], ['1e999', 'is too large'],
]) {
  test(`refuses ${JSON.stringify(text)} in a real-valued field`, () => {
    const r = real(text, 'bp')
    assert.equal(r.ok, false)
    assert.ok(r.message.includes(message), r.message)
    assert.equal(r.readings, undefined)
  })
}

for (const [text, message] of [
  ['1.5', 'is not a whole number. Type a whole number, such as 2.'],
  ['0,5', 'is not a whole number. Type a whole number, such as 1.'],
  ['12,34', 'is not a whole number. Type a whole number, such as 12.'],
  ['1,00,000', 'grouped unevenly'],
  ['1e20', 'is too large'],
]) {
  test(`refuses ${JSON.stringify(text)} in an integer field`, () => {
    const r = whole(text)
    assert.equal(r.ok, false)
    assert.ok(r.message.includes(message), r.message)
  })
}
