import { useEffect, useMemo, useRef, useState } from 'react'
import { useAICapabilities } from '../../hooks/useAICapabilities'
import { Alert, Box, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAISDKRuntime } from '@assistant-ui/ai-sdk'
import { Thread } from './Thread'

export function ChatSession({
  conversationId,
  messages,
  onComplete,
  onRunningChange,
}: {
  conversationId: string
  messages: UIMessage[]
  onRunningChange?: (running: boolean) => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const { chat: capabilities, isLoading } = useAICapabilities()
  const [webSearch, setWebSearch] = useState(false)
  const requestedSearch = useRef(false)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/assistant/chat',
        credentials: 'include',
        body: { conversationId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        prepareSendMessagesRequest: ({ messages, body, trigger, messageId }) => ({
          body: { ...body, messages: messages.slice(-1), trigger, messageId, webSearch: requestedSearch.current },
        }),
      }),
    [conversationId]
  )
  const chat = useChat({ id: conversationId, messages, transport, onFinish: onComplete })
  const running = chat.status === 'submitted' || chat.status === 'streaming'
  useEffect(() => {
    onRunningChange?.(running)
  }, [running, onRunningChange])
  useEffect(
    () => () => {
      onRunningChange?.(false)
    },
    [onRunningChange]
  )
  const runtime = useAISDKRuntime(chat)
  const { stop } = chat
  useEffect(
    () => () => {
      void stop()
    },
    [stop]
  )
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        {chat.error && (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                onClick={() => {
                  chat.clearError()
                  void chat.regenerate()
                }}
              >
                {t('encore.retry')}
              </Button>
            }
          >
            {chat.error.message}
          </Alert>
        )}
        <Thread
          webSearch={{
            enabled: webSearch,
            available: capabilities.supportsWebSearch,
            loading: isLoading,
            running,
            onToggle: () => {
              requestedSearch.current = !webSearch
              setWebSearch(!webSearch)
            },
          }}
        />
      </Box>
    </AssistantRuntimeProvider>
  )
}
