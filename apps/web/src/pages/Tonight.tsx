import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, Card, CardContent, Grid, LinearProgress, Skeleton, Stack, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { FALLBACK_POSTER_URL, getProxiedImageUrl } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

interface TonightItem {
  id: string
  title: string
  detail: string | null
  posterUrl: string | null
  embyUrl: string
  minutes?: number
  progress?: number
  reason?: string | null
}

type TonightResponse =
  | { status: 'unsupported' | 'sign-in' }
  | { status: 'ready'; resume: TonightItem[]; picks: TonightItem[] }

function TonightCard({ item, resume }: { item: TonightItem; resume: boolean }) {
  const { t } = useTranslation()
  const time = item.minutes === undefined ? null : t(resume ? 'tonight.minutesLeft' : 'tonight.minutes', { count: item.minutes })
  const metadata = [item.detail, time].filter(Boolean).join(' · ')

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: resume ? 'row' : 'column' }}>
      <Box
        component="img"
        src={getProxiedImageUrl(item.posterUrl)}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith(FALLBACK_POSTER_URL)) event.currentTarget.src = FALLBACK_POSTER_URL
        }}
        alt=""
        loading="lazy"
        sx={{
          width: resume ? { xs: 86, sm: 104 } : '100%',
          height: resume ? 'auto' : { xs: 195, md: 240 },
          objectFit: 'cover',
          objectPosition: 'center 30%',
          flexShrink: 0,
        }}
      />
      <CardContent sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography component="h3" variant="h6">{item.title}</Typography>
        {metadata && <Typography variant="body2" color="text.secondary">{metadata}</Typography>}
        {item.progress !== undefined && (
          <LinearProgress
            variant="determinate"
            value={item.progress}
            aria-label={t('tonight.progress', { title: item.title })}
          />
        )}
        {!resume && item.reason && <Typography variant="body2" color="text.secondary">{item.reason}</Typography>}
        <Box sx={{ mt: 'auto', pt: 0.5 }}>
          <Button
            component="a"
            href={item.embyUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
            variant={resume ? 'outlined' : 'contained'}
            size="small"
            aria-label={t('tonight.openTitle', { title: item.title })}
          >
            {t('tonight.openInEmby')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export function TonightPage() {
  const { t } = useTranslation()
  const userId = useAuth().user?.id
  const [data, setData] = useState<TonightResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    fetch('/api/recommendations/me/tonight', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Tonight unavailable')
        const result: TonightResponse = await response.json()
        if (!controller.signal.aborted) setData(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [userId])

  return (
    <Stack spacing={4} sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box>
        <Typography component="h1" variant="h4" fontWeight={700} gutterBottom>{t('tonight.title')}</Typography>
        <Typography color="text.secondary">{t('tonight.subtitle')}</Typography>
      </Box>
      {failed ? <Alert severity="warning">{t('tonight.error')}</Alert>
        : !data ? <Skeleton variant="rounded" height={160} aria-label={t('tonight.loading')} />
        : data.status === 'ready' ? (
          <>
            <Box component="section" aria-labelledby="tonight-continue">
              <Typography id="tonight-continue" component="h2" variant="h5" gutterBottom>
                {t('tonight.continueWatching')}
              </Typography>
              {data.resume.length ? (
                <Grid container spacing={2}>
                  {data.resume.map((item) => (
                    <Grid item xs={12} sm={6} key={item.id}><TonightCard item={item} resume /></Grid>
                  ))}
                </Grid>
              ) : <Typography color="text.secondary">{t('tonight.noResume')}</Typography>}
            </Box>
            <Box component="section" aria-labelledby="tonight-picks">
              <Typography id="tonight-picks" component="h2" variant="h5" gutterBottom>{t('tonight.picks')}</Typography>
              {data.picks.length ? (
                <Grid container spacing={2}>
                  {data.picks.map((item) => (
                    <Grid item xs={12} sm={6} md={4} key={item.id}><TonightCard item={item} resume={false} /></Grid>
                  ))}
                </Grid>
              ) : <Typography color="text.secondary">{t('tonight.noPicks')}</Typography>}
            </Box>
          </>
        ) : <Alert severity="info">{t(data.status === 'sign-in' ? 'tonight.signIn' : 'tonight.embyOnly')}</Alert>}
    </Stack>
  )
}
