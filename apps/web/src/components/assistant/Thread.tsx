import { MobileWelcome } from './MobileWelcome'
import { Box, Button, IconButton, Paper, Typography, useMediaQuery, useTheme } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import ReactMarkdown from 'react-markdown'
import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useAui,
  useAuiState,
} from '@assistant-ui/react'
import { useTranslation } from 'react-i18next'
import { ToolResult } from './ToolResult'
import { NextReplies } from './NextReplies'
import { composerActionSx } from './composerStyles'
import { ReasoningPresetMenu, type ReasoningPresetControl } from './ReasoningPresetMenu'
import { WebSearchSource, WebSearchToggle, type WebSearchControl } from './WebSearchControls'

function Welcome() {
  const { t } = useTranslation()
  const composer = useAui().composer
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  if (mobile) return <MobileWelcome />
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Typography variant="overline" color="primary.main" sx={{ letterSpacing: '.18em' }}>
        {t('encore.eyebrow')}
      </Typography>
      <Typography
        component="h2"
        variant="h3"
        sx={{
          fontWeight: 650,
          letterSpacing: '-.04em',
          my: 2,
          maxWidth: 580,
          fontSize: 'clamp(28px, 3vw, 40px)',
          lineHeight: 1.15,
        }}
      >
        {t('encore.welcome')}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ maxWidth: 580, fontSize: 17, lineHeight: 1.6, mb: 3 }}
      >
        {t('encore.intro')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {['tonight', 'discover', 'taste', 'similar', 'releases', 'filmography'].map((key) => (
          <Button
            key={key}
            variant="outlined"
            onClick={() => {
              composer.setText(t(`encore.prompts.${key}`))
              composer.send()
            }}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'start',
              p: 2,
              fontSize: 16,
              fontWeight: 500,
              minHeight: 80,
              borderColor: 'divider',
              borderRadius: 3,
              color: 'text.primary',
              textTransform: 'none',
              lineHeight: 1.5,
            }}
          >
            {t(`encore.prompts.${key}`)}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', py: { xs: 1.25, md: 1.5 } }}>
        <Paper
          elevation={0}
          sx={{
            px: { xs: 1.75, md: 2.5 },
            py: { xs: 1.125, md: 1.5 },
            fontSize: { xs: 16, md: 17 },
            lineHeight: 1.55,
            maxWidth: '85%',
            borderRadius: '22px 22px 5px 22px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            overflowWrap: 'anywhere',
            '& p': { m: 0, lineHeight: 'inherit' },
          }}
        >
          <MessagePrimitive.Content />
        </Paper>
      </Box>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <Box sx={{ display: 'flex', gap: { xs: 0, md: 2 }, py: { xs: 1.25, md: 2 }, minWidth: 0 }}>
        <Box
          sx={{
            display: 'none',
            width: 28,
            height: 28,
            flexShrink: 0,
            color: 'primary.main',
            pt: 0.25,
          }}
        >
          <AutoAwesomeOutlinedIcon fontSize="small" />
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            overflowWrap: 'anywhere',
            '&& > *': { my: 0 },
            fontSize: { xs: 16, md: 17 },
            lineHeight: 1.65,
          }}
        >
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => (
                <Box
                  sx={{
                    '& p': { lineHeight: 1.65, m: 0 },
                    '& p + p, & p + ul, & p + ol': { mt: 1.5 },
                    '& ol, & ul': { paddingInlineStart: { xs: '1.35em', md: undefined } },
                    '& li + li': { mt: { xs: 0.5, md: 0 } },
                    '& a': { color: 'primary.main' },
                    '& pre': { whiteSpace: 'pre-wrap' },
                  }}
                >
                  <ReactMarkdown>{text}</ReactMarkdown>
                </Box>
              ),
              Source: WebSearchSource,
              tools: {
                Fallback: ({ toolName, result, isError, status }) => (
                  <ToolResult
                    toolName={toolName}
                    result={result}
                    isError={isError}
                    status={status}
                  />
                ),
              },
            }}
          />
          <NextReplies />
        </Box>
      </Box>
    </MessagePrimitive.Root>
  )
}

type ComposerControls = { webSearch: WebSearchControl; reasoning: ReasoningPresetControl }

function Composer({ webSearch, reasoning }: ComposerControls) {
  const { t } = useTranslation(),
    mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        pt: 1,
        pb: { xs: 1, md: 2 },
        flexShrink: 0,
        maxWidth: 900,
        width: '100%',
        mx: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <ComposerPrimitive.Root>
        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.25,
            p: { xs: 1, md: 1.25 },
            borderRadius: '28px',
            bgcolor: { xs: 'background.paper', md: 'background.default' },
            '& textarea': { maxHeight: 144, overflowY: 'auto' },
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: '0 0 0 2px var(--ap-focus-ring, rgba(99,102,241,.12))',
            },
          }}
        >
          <ComposerPrimitive.Input
            placeholder={t(mobile ? 'encore.open' : 'encore.placeholder')}
            aria-label={t('encore.placeholder')}
            rows={1}
            enterKeyHint="send"
            style={{
              width: '100%',
              flexBasis: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              resize: 'none',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'inherit',
              font: 'inherit',
              padding: '10px 12px',
              fontSize: mobile ? 16 : 17,
              lineHeight: '24px',
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0.5 }}>
            <WebSearchToggle {...webSearch} />
            <ReasoningPresetMenu {...reasoning} />
          </Box>
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <IconButton
                aria-label={t('encore.send')}
                color="primary"
                sx={{
                  ...composerActionSx,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <ArrowUpwardIcon />
              </IconButton>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <IconButton aria-label={t('encore.stop')} color="primary" sx={composerActionSx}>
                <StopRoundedIcon />
              </IconButton>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </Paper>
      </ComposerPrimitive.Root>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'center', mt: 1 }}
      >
        {t('encore.footer')}
      </Typography>
    </Box>
  )
}

export function Thread({ webSearch, reasoning }: ComposerControls) {
  const { t } = useTranslation()
  const empty = useAuiState((state) => state.thread.messages.length === 0)
  return (
    <ThreadPrimitive.Root
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <ThreadPrimitive.Viewport
        className="encore-thread-viewport"
        autoScroll={!empty}
        scrollToBottomOnInitialize={!empty}
        scrollToBottomOnThreadSwitch={!empty}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
        <ThreadPrimitive.Empty>
          <Welcome />
        </ThreadPrimitive.Empty>
        <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 1, md: 2 } }}>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          <ThreadPrimitive.If running>
            <Typography variant="caption" color="text.secondary" role="status">
              {t('encore.thinking')}
            </Typography>
          </ThreadPrimitive.If>
        </Box>
      </ThreadPrimitive.Viewport>
      <Composer webSearch={webSearch} reasoning={reasoning} />
    </ThreadPrimitive.Root>
  )
}
