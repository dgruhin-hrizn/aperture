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
import { WebSearchSource, WebSearchToggle, type WebSearchControl } from './WebSearchControls'

function Welcome() {
  const { t } = useTranslation()
  const composer = useAui().composer
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  if (mobile) return <MobileWelcome />
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: { xs: 4, md: 8 } }}>
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
          fontSize: { xs: 32, md: 44 },
        }}
      >
        {t('encore.welcome')}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 540, lineHeight: 1.8, mb: 4 }}>
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
              p: 2.5,
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
            fontSize: { xs: 16, md: 'inherit' },
            lineHeight: { xs: 1.5, md: 'inherit' },
            maxWidth: '85%',
            borderRadius: '22px 22px 5px 22px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            overflowWrap: 'anywhere',
            '& p': { my: { xs: 0, md: undefined }, lineHeight: { xs: 'inherit', md: undefined } },
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
            display: { xs: 'none', md: 'block' },
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
            fontSize: { xs: 16, md: 'inherit' },
            lineHeight: { xs: 1.625, md: 'inherit' },
            '& p': { lineHeight: { xs: 1.625, md: 1.85 }, m: 0 },
            '& ol, & ul': { paddingInlineStart: { xs: '1.35em', md: undefined } },
            '& li + li': { mt: { xs: 0.5, md: 0 } },
            '& a': { color: 'primary.main' },
            '& pre': { whiteSpace: 'pre-wrap' },
          }}
        >
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => <ReactMarkdown>{text}</ReactMarkdown>,
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

function Composer({ webSearch }: { webSearch: WebSearchControl }) {
  const { t } = useTranslation(),
    mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 4 },
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
            alignItems: 'flex-end',
            gap: 1,
            p: { xs: 1, md: 1.25 },
            borderRadius: { xs: '32px', md: 4 },
            bgcolor: { xs: 'background.paper', md: 'background.default' },
            '& textarea': { maxHeight: 144, overflowY: 'auto' },
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: '0 0 0 2px var(--ap-focus-ring, rgba(99,102,241,.12))',
            },
          }}
        >
          <WebSearchToggle {...webSearch} />
          <ComposerPrimitive.Input
            placeholder={t(mobile ? 'encore.open' : 'encore.placeholder')}
            aria-label={t('encore.placeholder')}
            rows={1}
            enterKeyHint="send"
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              resize: 'none',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'inherit',
              font: 'inherit',
              padding: '10px 4px',
              fontSize: 16,
              lineHeight: '24px',
            }}
          />
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

export function Thread({ webSearch }: { webSearch: WebSearchControl }) {
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
        <Box sx={{ maxWidth: 850, mx: 'auto', px: { xs: 1.5, md: 4 }, py: { xs: 1, md: 2 } }}>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          <ThreadPrimitive.If running>
            <Typography variant="caption" color="text.secondary" role="status">
              {t('encore.thinking')}
            </Typography>
          </ThreadPrimitive.If>
        </Box>
      </ThreadPrimitive.Viewport>
      <Composer webSearch={webSearch} />
    </ThreadPrimitive.Root>
  )
}
