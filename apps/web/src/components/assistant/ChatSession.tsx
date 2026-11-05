import { useEffect, useMemo } from 'react'
import { Alert, Box, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAISDKRuntime } from '@assistant-ui/ai-sdk'
import { Thread } from './Thread'

export function ChatSession({ conversationId, messages, onComplete }: { conversationId: string; messages: UIMessage[]; onComplete: () => void }) {
  const { t } = useTranslation()
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant/chat', credentials: 'include', body: { conversationId } }), [conversationId])
  const chat = useChat({ id: conversationId, messages, transport, onFinish: onComplete })
  const runtime = useAISDKRuntime(chat)
  const { stop } = chat
  useEffect(() => () => { void stop() }, [stop])
  return <AssistantRuntimeProvider runtime={runtime}>
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {chat.error && <Alert severity="error" action={<Button color="inherit" onClick={() => { chat.clearError(); void chat.regenerate() }}>{t('encore.retry')}</Button>}>{chat.error.message}</Alert>}
      <Thread />
    </Box>
  </AssistantRuntimeProvider>
}
