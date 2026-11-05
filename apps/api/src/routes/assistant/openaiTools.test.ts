import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import Fastify from 'fastify'
import { z } from 'zod'
import { asSchema, stepCountIs, ToolLoopAgent, toUIMessageStream } from 'ai'
import { getPool, closePool, getChatModelInstance } from '@aperture/core'
import { createEncoreTools, getEncoreToolSchemas } from '@aperture/core/encore'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
after(closePool)
const context = {
  userId: randomUUID(),
  isAdmin: false,
  embeddingModel: null,
  embeddingModelId: '',
  mediaServer: null,
}

test('every native/MCP tool advertises an object root while playlist branches retain canonical validation', async () => {
  for (const source of ['encore', 'mcp'] as const) {
    const tools = createEncoreTools({ ...context, source })
    const app = Fastify()
    for (const [name, schema] of Object.entries(await getEncoreToolSchemas(tools))) {
      assert.equal(schema.type, 'object', `${source}: ${name}`)
      assert.equal(schema.anyOf, undefined, `${source}: ${name} has a top-level union`)
      assert.equal(schema.oneOf, undefined, `${source}: ${name} has a top-level union`)
      app.post(`/contracts/${name}`, { schema: { body: schema } }, async () => ({ ok: true }))
    }
    try {
      await app.ready()
    } finally {
      await app.close()
    }
    const validate = asSchema(tools.proposePlaylist.inputSchema).validate!
    const items = [{ id: randomUUID(), type: 'movie' }]
    for (const input of [
      { operation: 'create', name: 'An evening', items },
      { operation: 'update', collectionId: randomUUID(), items },
    ])
      assert.equal((await validate(input)).success, true)
    for (const input of [
      { operation: 'create', items },
      { operation: 'update', items },
      { operation: 'pin', collectionId: randomUUID() },
      { operation: 'create', name: '', items },
      { operation: 'create', name: 'Empty', items: [] },
    ])
      assert.equal((await validate(input)).success, false)
  }
})

test('the shared boundary rejects malformed tool metadata by name before a provider request', async () => {
  await assert.rejects(
    getEncoreToolSchemas({
      brokenPlaylist: {
        inputSchema: z.union([z.object({ create: z.string() }), z.object({ update: z.string() })]),
      },
    }),
    /brokenPlaylist.*object root/
  )
})

test(
  'the configured OpenAI Responses and compatible Chat adapters serialize all tools and complete an agent tool round trip',
  { timeout: 15_000 },
  async () => {
    let calls = 0,
      provider = 'openai'
    const failures: string[] = []
    const server = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = JSON.parse(Buffer.concat(chunks).toString())
        calls++
        assert.equal(body.stream, true)
        assert.equal(body.tools.length, 42)
        for (const entry of body.tools) {
          const tool = entry.function ?? entry
          assert.equal(tool.parameters.type, 'object', tool.name)
          assert.equal(tool.parameters.anyOf, undefined, tool.name)
        }
        const second = calls % 2 === 0
        if (second)
          assert.match(JSON.stringify(body.input ?? body.messages), /call_memory[\s\S]*memories/)
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        const emit = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`)
        if (request.url?.endsWith('/responses')) {
          emit({
            type: 'response.created',
            response: { id: `resp_${calls}`, created_at: 1700000000, model: 'fixture-model' },
          })
          const item = second
            ? {
                type: 'message',
                id: 'msg_result',
                role: 'assistant',
                content: [
                  { type: 'output_text', text: 'Your memories are ready.', annotations: [] },
                ],
              }
            : {
                type: 'function_call',
                id: 'fc_memory',
                call_id: 'call_memory',
                name: 'listMemories',
                arguments: '{}',
                status: 'completed',
              }
          emit({ type: 'response.output_item.added', output_index: 0, item })
          if (second)
            emit({
              type: 'response.output_text.delta',
              item_id: item.id,
              output_index: 0,
              delta: 'Your memories are ready.',
            })
          else {
            emit({
              type: 'response.function_call_arguments.delta',
              item_id: item.id,
              output_index: 0,
              delta: '{}',
            })
            emit({
              type: 'response.function_call_arguments.done',
              item_id: item.id,
              output_index: 0,
              arguments: '{}',
            })
          }
          emit({ type: 'response.output_item.done', output_index: 0, item })
          emit({
            type: 'response.completed',
            response: { usage: { input_tokens: 20, output_tokens: 10 } },
          })
        } else {
          const delta = second
            ? { content: 'Your memories are ready.' }
            : {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_memory',
                    type: 'function',
                    function: { name: 'listMemories', arguments: '{}' },
                  },
                ],
              }
          emit({
            id: `chat_${calls}`,
            object: 'chat.completion.chunk',
            created: 1700000000,
            model: 'fixture-model',
            choices: [{ index: 0, delta, finish_reason: null }],
          })
          emit({
            id: `chat_${calls}`,
            object: 'chat.completion.chunk',
            created: 1700000000,
            model: 'fixture-model',
            choices: [{ index: 0, delta: {}, finish_reason: second ? 'stop' : 'tool_calls' }],
          })
          response.write('data: [DONE]\n\n')
        }
        response.end()
      } catch (error) {
        failures.push(String(error))
        response
          .writeHead(400, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: { message: String(error) } }))
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const pool = getPool(),
      originalQuery = pool.query
    Object.assign(pool, {
      query: async (sql: string) => {
        let rows: unknown[] = []
        if (sql.includes('FROM system_settings'))
          rows = [
            {
              value: JSON.stringify({
                chat: {
                  provider,
                  model: 'fixture-model',
                  apiKey: 'fixture-key',
                  baseUrl: `http://127.0.0.1:${address.port}/v1`,
                },
              }),
            },
          ]
        else if (sql.includes('FROM users')) rows = [{ is_enabled: true, provider_disabled: false }]
        else assert.match(sql, /FROM encore_memories/)
        return { rows, rowCount: rows.length }
      },
    })
    try {
      for (provider of ['openai', 'openai-compatible']) {
        calls = 0
        const tools = createEncoreTools(context)
        const agent = new ToolLoopAgent({
          model: await getChatModelInstance(),
          tools,
          stopWhen: stepCountIs(3),
        })
        const result = await agent.stream({ prompt: 'Inspect my saved memories.', timeout: 5000 })
        const output: unknown[] = []
        for await (const chunk of toUIMessageStream({ stream: result.stream, tools }))
          output.push(chunk)
        assert.deepEqual(failures, [], provider)
        assert.equal(calls, 2, provider)
        assert.match(JSON.stringify(output), /Your memories are ready/)
        assert.match(JSON.stringify(output), /tool-output-available/)
        assert.doesNotMatch(JSON.stringify(output), /"type":"error"/)
      }
    } finally {
      pool.query = originalQuery
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
)
