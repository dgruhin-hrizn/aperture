import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseExplanationResponse } from './explanationResponse.js'
import { getPlotHeadings } from '../../strm/plotHeadings.js'

test('parses fenced explanations with French apostrophes and valid escapes', () => {
  const text = String.raw`{"explanations":[{"index":1,"explanation":"C\'est \"bien\". \\n \u00e9"}]}`
  assert.deepEqual(parseExplanationResponse('Here you go\n```JSON\n' + text + '\n```'), [
    { index: 1, explanation: 'C\'est "bien". \\n é' },
  ])
})

test('retains unknown backslashes and rejects malformed entries', () => {
  assert.deepEqual(parseExplanationResponse(String.raw`[null,{"index":1,"explanation":4},{"index":2,"explanation":"a\q"}]`), [
    { index: 2, explanation: String.raw`a\q` },
  ])
  assert.throws(() => parseExplanationResponse('{"explanations":['), SyntaxError)
})

test('uses French plot headings for AI output', () => {
  assert.equal(getPlotHeadings('fr').movie, 'À propos de ce film :')
  assert.equal(getPlotHeadings('fr').why, 'Pourquoi Aperture vous recommande ce titre :')
})
