import type { ReasoningPreset } from '@aperture/core'
import type { StepResult, ToolSet, UIMessage, UIMessageChunk } from 'ai'

function privatePart(type: string) {
  return type === 'reasoning' || type.startsWith('reasoning-') || type === 'custom'
}

function publicPart<T extends object>(part: T): T {
  const copy = { ...part }
  for (const key of ['providerMetadata', 'callProviderMetadata', 'resultProviderMetadata', 'toolMetadata']) {
    Reflect.deleteProperty(copy, key)
  }
  return copy
}

export function visibleMessage(message: UIMessage): UIMessage {
  return { ...message, parts: message.parts.filter(part => !privatePart(part.type)).map(publicPart) }
}

export function visibleStream() {
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === 'finish' && chunk.finishReason === 'length') {
        controller.enqueue({ type: 'error', errorText: 'ENCORE_OUTPUT_LIMIT' })
      }
      if (!privatePart(chunk.type)) controller.enqueue(publicPart(chunk))
    },
  })
}

export const ENCORE_MAX_STEPS = 12

export const replyStyle: Record<ReasoningPreset, string> = {
  quick: 'Keep this reply brief. Use the tools needed to answer accurately and give the strongest matches first.',
  standard: '',
  expanded: 'Work through the request thoroughly. Verify relevant details with tools and explain meaningful alternatives or trade-offs.',
}

export function encoreBudget(visibleLimit: number, overhead = 0, maxSteps = ENCORE_MAX_STEPS) {
  const perStep = visibleLimit + overhead
  const total = Math.max(16000, perStep * 3)
  const reserve = overhead + Math.min(1500, Math.floor(visibleLimit / 2))
  let used = 0
  let allowance = perStep
  return {
    // If the provider omits usage, account for the full allowance for that step.
    onStepEnd({ usage }: StepResult<ToolSet>) { used += usage.outputTokens ?? allowance },
    stopWhen: () => total - used <= overhead,
    prepareStep({ stepNumber }: { stepNumber: number }) {
      const remaining = total - used
      const finalStep = stepNumber === maxSteps - 1 || remaining <= perStep + reserve
      allowance = Math.min(perStep, finalStep ? remaining : remaining - reserve)
      return { maxOutputTokens: allowance - overhead, ...(finalStep && { toolChoice: 'none' as const }) }
    },
  }
}
