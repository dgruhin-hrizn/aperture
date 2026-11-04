import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeAppearance, resolveColorMode } from './preferences'
import { createAppTheme } from '../theme'
import { getContrastRatio } from '@mui/material/styles'

test('missing or invalid preferences preserve Classic and never opt a user into Studio', () => {
  for (const value of [undefined, null, {}, 'studio', { theme: 'future', mode: 'unexpected' }]) {
    const prefs = normalizeAppearance(value)
    assert.equal(prefs.theme, 'classic')
    assert.equal(resolveColorMode(prefs, false), 'dark')
  }
  assert.deepEqual(normalizeAppearance({ theme: 'studio', mode: 'light', other: true }), {
    theme: 'studio',
    mode: 'light',
  })
})

test('Studio follows the device only in system mode; Classic keeps the saved Studio mode', () => {
  assert.equal(resolveColorMode({ theme: 'studio', mode: 'system' }, false), 'light')
  assert.equal(resolveColorMode({ theme: 'studio', mode: 'system' }, true), 'dark')
  assert.equal(resolveColorMode({ theme: 'studio', mode: 'light' }, true), 'light')
  assert.equal(resolveColorMode({ theme: 'studio', mode: 'dark' }, false), 'dark')
  assert.equal(resolveColorMode({ theme: 'classic', mode: 'light' }, false), 'dark')
  assert.deepEqual(normalizeAppearance({ theme: 'classic', mode: 'light' }), {
    theme: 'classic',
    mode: 'light',
  })
})

test('Classic is identical regardless of the Studio color choice and retains the original palette', () => {
  const original = createAppTheme('ltr')
  assert.deepEqual(
    JSON.parse(JSON.stringify(createAppTheme('ltr', 'classic', 'light'))),
    JSON.parse(JSON.stringify(original))
  )
  assert.equal(original.palette.background.default, '#0f0f0f')
  assert.equal(original.palette.background.paper, '#1a1a1a')
  assert.equal(original.palette.primary.main, '#6366f1')
  assert.equal(original.palette.mode, 'dark')
  assert.match(original.typography.fontFamily ?? '', /^"Inter"/)
})

test('Studio themes apply across shared components and keep direction independent of appearance', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      const theme = createAppTheme(direction, 'studio', mode)
      assert.equal(theme.direction, direction)
      assert.equal(theme.palette.mode, mode)
      assert.equal(theme.palette.background.default, mode === 'light' ? '#f1f4fa' : '#0b101c')
      assert.match(theme.typography.fontFamily ?? '', /^"Manrope"/)
      for (const name of [
        'MuiCard',
        'MuiDialog',
        'MuiTableCell',
        'MuiOutlinedInput',
        'MuiMenu',
        'MuiDrawer',
        'MuiTooltip',
        'MuiLinearProgress',
      ] as const) {
        assert.ok(theme.components?.[name]?.styleOverrides, `${name} is themed`)
      }
      const baseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, string>
      >
      assert.equal(baseline[':root']['--ap-canvas'], theme.palette.background.default)
      assert.equal(baseline[':root']['--ap-text'], theme.palette.text.primary)
      assert.equal(baseline[':root']['--ap-graph-bg'], theme.palette.background.default)
    }
  }
})

test('Studio text and primary actions retain readable contrast in both modes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const theme = createAppTheme('ltr', 'studio', mode)
    for (const surface of [theme.palette.background.default, theme.palette.background.paper]) {
      assert.ok(getContrastRatio(theme.palette.text.primary, surface) >= 4.5)
      assert.ok(getContrastRatio(theme.palette.text.secondary, surface) >= 4.5)
      assert.ok(getContrastRatio(theme.palette.primary.main, surface) >= 4.5)
    }
    const button = theme.components?.MuiButton?.styleOverrides?.containedPrimary as {
      color: string
      backgroundColor: string
    }
    assert.ok(getContrastRatio(button.color, button.backgroundColor) >= 4.5)
  }
})
