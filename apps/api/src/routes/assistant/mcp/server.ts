import { randomUUID } from 'node:crypto'
import { McpServer, fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server'
import { createEncoreContext, createEncoreTools, getEncoreToolSchemas, encoreToolScope, type EncoreScope } from '@aperture/core/encore'
import { APP_VERSION } from '../../../lib/appVersion.js'

export async function createApertureMcpServer(userId: string, scopes: EncoreScope[], connectionId?: string) {
  const server = new McpServer({ name: 'Aperture', version: APP_VERSION }, {
    instructions: 'Aperture is your personal media consultant. Search and semantic tools return only the authenticated user’s accessible library. Public discovery/release tools include explicit source and availability. Never equate an announced release with a playable Emby item. Save only information explicitly offered to Aperture memory tools; full external conversations are not automatically retained.',
  })
  const tools = createEncoreTools({...await createEncoreContext(userId),source:'mcp',sourceId:connectionId}, scopes)
  const schemas = await getEncoreToolSchemas(tools)
  for (const [name, definition] of Object.entries(tools)) {
    const execute = definition.execute
    if (!execute) continue
    const schema = schemas[name]
    server.registerTool(name, { description: typeof definition.description === 'string' ? definition.description : name, inputSchema: fromJsonSchema(schema as JsonSchemaType),
      annotations: { readOnlyHint: !encoreToolScope(name).endsWith(':write') || name.startsWith('list'), destructiveHint: ['forgetMemory','deleteWatchPlan','executeEncoreAction','controlCuration'].includes(name), idempotentHint: !['createWatchPlan','prepareCuration','controlCuration'].includes(name), openWorldHint: ['discoverTitles', 'getReleaseSchedule', 'getFilmography', 'getExternalTitleDetails','executeEncoreAction','controlCuration'].includes(name) },
    }, async (input, context) => {
      try {
        const output = await execute(input as never, { toolCallId: randomUUID(), messages: [], context: undefined, abortSignal: context.mcpReq.signal })
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output && typeof output === 'object' && !Array.isArray(output) ? output as Record<string, unknown> : { result: output } }
      } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'The Aperture tool could not complete' }] } }
    })
  }
  return server
}
