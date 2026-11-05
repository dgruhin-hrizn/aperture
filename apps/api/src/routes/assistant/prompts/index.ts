import { resolveEffectiveAiLanguage, buildAiLanguageInstruction } from '@aperture/core'
import { IDENTITY } from './identity.js'
import { buildUserContext } from './context/user.js'
export { ASSISTANT_NAME } from './identity.js'
export async function buildSystemPrompt(userId: string, isAdmin: boolean): Promise<string> {
  const [context, locale] = await Promise.all([buildUserContext(userId, isAdmin), resolveEffectiveAiLanguage(userId)])
  return [IDENTITY, context, buildAiLanguageInstruction(locale)].join('\n\n')
}
