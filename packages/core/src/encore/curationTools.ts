import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { curationInput } from './curationSchemas.js'
import { prepareEncoreCuration, listEncoreCurations, controlEncoreCuration } from './curations.js'
import { runDueEncoreCurations } from './curationRunner.js'
import type { ToolContext } from './types.js'
import type { EncoreScope } from './permissions.js'
export function createCurationTools(ctx: ToolContext, scopes: readonly EncoreScope[]): ToolSet {
  return {
    listCurations: tool({
      description:
        'Inspect owned recurring curation rules, next/last run, outcomes and failures. Suggestions are the default; rules start paused.',
      inputSchema: z.object({}),
      execute: () => listEncoreCurations(ctx.userId),
    }),
    prepareCuration: tool({
      description:
        'Prepare an opt-in recurring playlist rule from a standing instruction. Requires an existing managed playlist and explicit cadence, local time and timezone. Always creates a paused draft; the user must enable it. Uses deterministic eligibility and optional semantic search, preserving manual edits.',
      inputSchema: curationInput,
      execute: (input) => prepareEncoreCuration(ctx, input, scopes),
    }),
    updateCuration: tool({
      description:
        'Edit an owned rule with its current revision. Edits pause the rule for renewed user opt-in. Do not invent a broader recipe than requested.',
      inputSchema: z.object({
        id: z.string().uuid(),
        revision: z.number().int().positive(),
        input: curationInput,
      }),
      execute: ({ id, revision, input }) => prepareEncoreCuration(ctx, input, scopes, id, revision),
    }),
    pauseCuration: tool({
      description: 'Pause an owned recurring rule when requested.',
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: ({ id }) => controlEncoreCuration(ctx, id, 'pause', scopes),
    }),
    ...(ctx.source === 'mcp'
      ? {
          controlCuration: tool({
            description:
              'Enable, run or remove an exact previewed curation rule only after explicit human approval. Enabling authorizes recurring writes and possible embedding costs until paused, the connection expires/is revoked, or eligibility/access fails. Run requires an enabled rule.',
            inputSchema: z.object({
              id: z.string().uuid(),
              operation: z.enum(['enable', 'run', 'delete']),
              approved: z.literal(true),
            }),
            execute: async ({ id, operation }) => {
              const result = await controlEncoreCuration(ctx, id, operation, scopes)
              if (operation === 'run') {
                await runDueEncoreCurations({ id, userId: ctx.userId, limit: 1 })
                return listEncoreCurations(ctx.userId)
              }
              return result
            },
          }),
        }
      : {}),
  }
}
