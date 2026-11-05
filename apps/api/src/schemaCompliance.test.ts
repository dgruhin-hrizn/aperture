import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'

const documentSchema = z
  .object({
    openapi: z.string().regex(/^3\./),
    info: z.object({ version: z.string().min(1) }).passthrough(),
    paths: z.record(z.record(z.unknown())),
    components: z.object({ schemas: z.record(z.unknown()) }).passthrough(),
  })
  .passthrough()

function assertReferences(value: unknown, document: unknown, path = '#') {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string' && child.startsWith('#/')) {
      let target = document
      for (const part of child.slice(2).split('/')) {
        const name = decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~')
        target =
          target && typeof target === 'object'
            ? (target as Record<string, unknown>)[name]
            : undefined
      }
      assert.notEqual(target, undefined, `Unresolved API schema reference at ${path}: ${child}`)
    } else assertReferences(child, document, `${path}/${key}`)
  }
}

test(
  'the complete API compiles its request/response schemas and publishes resolvable OpenAPI contracts offline',
  { timeout: 30_000 },
  async () => {
    const environment = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    process.env.SESSION_SECRET ??= 'schema-audit-fixture-not-a-production-secret'
    process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
    const { buildServer } = await import('./server.js')
    const { closePool } = await import('@aperture/core')
    const app = await buildServer({ logger: false, schemaAudit: true })
    try {
      // Fastify compiles every registered request validator and response serializer here.
      await app.ready()
      const document = documentSchema.parse(app.swagger())
      assertReferences(document, document)
      let operations = 0
      for (const methods of Object.values(document.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method))
            continue
          const contract = z
            .object({ responses: z.record(z.unknown()) })
            .passthrough()
            .parse(operation)
          assert.ok(Object.keys(contract.responses).length > 0)
          operations++
        }
      }
      assert.ok(operations > 0)
      console.info(
        `Compiled ${operations} HTTP operations and resolved published schema references`
      )
      const version = await app.inject('/api/version')
      assert.equal(version.statusCode, 200)
      assert.equal(version.json().version, document.info.version)
    } finally {
      await app.close()
      await closePool()
      if (environment === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = environment
    }
  }
)
