import { tool, isToolUIPart, getToolName, type StopCondition, type Tool, type ToolSet, type UIMessage } from 'ai'
import { z } from 'zod'

const nextRepliesName = 'suggestNextReplies'

type Suggestions = { suggestions: string[] }

export const suggestNextReplies: Tool<Suggestions, Suggestions> = tool({
  description: 'After finishing your answer, offer up to three short, distinct next messages the user could send. Keep them specific to this exchange and in the user’s language. Never suggest approving a write or claiming an action has already been authorized.',
  inputSchema: z.object({
    suggestions: z.array(z.string().trim().min(1).max(160)).min(1).max(3),
  }),
  execute: async ({ suggestions }) => ({ suggestions: [...new Set(suggestions)] }),
})

export const finishWithNextReplies: StopCondition<ToolSet> = ({ steps }) => {
  const last = steps.at(-1)
  return !!last
    && last.toolResults.some(result => result.toolName === nextRepliesName)
    && last.toolCalls.every(call => call.providerExecuted || call.toolName === nextRepliesName)
    && last.text.trim().length > 0
}

export function encoreModelHistory(messages: UIMessage[]): UIMessage[] {
  // Preserve citations and suggestions for display. The next model run needs the answer text.
  return messages.map(message => ({
    ...message,
    parts: message.parts.filter(part => {
      if (!isToolUIPart(part)) return true
      const name = getToolName(part)
      return name !== 'web_search' && name !== nextRepliesName
    }),
  }))
}

export const nextRepliesInstruction = 'After giving a complete answer, call suggestNextReplies once when there are useful follow-ups. Do not include the suggestions in your answer text or call this tool while you still need results from other tools.'
