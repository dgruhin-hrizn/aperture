import { resolveEffectiveAiLanguage, buildAiLanguageInstruction } from '@aperture/core'
import { buildEncoreMemoryContext } from '@aperture/core/encore'
import { IDENTITY } from './identity.js'
import { buildUserContext } from './context/user.js'
export { ASSISTANT_NAME } from './identity.js'
export async function buildSystemPrompt(userId: string, isAdmin: boolean): Promise<string> {
  const [context, locale, memories] = await Promise.all([buildUserContext(userId, isAdmin), resolveEffectiveAiLanguage(userId),buildEncoreMemoryContext(userId)])
  return [IDENTITY, context, memories, buildAiLanguageInstruction(locale)].join('\n\n')
}
