import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import rtlPlugin from 'stylis-plugin-rtl'
import { prefixer } from 'stylis'
import { useTranslation } from 'react-i18next'
import { isRtlLocale } from './i18n/localeDirection'
import { createAppTheme } from './theme'

const cacheLtr = createCache({ key: 'mui', prepend: true })
const cacheRtl = createCache({
  key: 'muirtl',
  prepend: true,
  stylisPlugins: [prefixer, rtlPlugin],
})

export function RtlProviders({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const [dir, setDir] = useState<'ltr' | 'rtl'>(() => (isRtlLocale(i18n.language) ? 'rtl' : 'ltr'))

  useEffect(() => {
    const handler = (lng: string) => {
      setDir(isRtlLocale(lng) ? 'rtl' : 'ltr')
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [i18n])

  const theme = useMemo(() => createAppTheme(dir), [dir])
  const cache = dir === 'rtl' ? cacheRtl : cacheLtr

  return (
    <CacheProvider key={dir} value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}
