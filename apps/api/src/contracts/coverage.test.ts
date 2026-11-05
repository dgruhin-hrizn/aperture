import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import ts from 'typescript'
import Fastify from 'fastify'

type Operation = {
  requestBody?: unknown
  parameters?: Array<{ in: string; name: string; schema?: { enum?: unknown[]; type?: string } }>
  'x-aperture-input-validation'?: string
}
type Paths = Record<string, Record<string, Operation>>

function propertyNames(value: unknown, document: unknown): Set<string> {
  if (!value || typeof value !== 'object') return new Set()
  const schema = value as Record<string, unknown>
  if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#/')) {
    let resolved = document
    for (const key of schema.$ref.slice(2).split('/')) resolved = (resolved as Record<string, unknown>)[key]
    return propertyNames(resolved, document)
  }
  const names = new Set(Object.keys(schema.properties ?? {}))
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const branches = schema[key]
    if (Array.isArray(branches)) for (const branch of branches) for (const name of propertyNames(branch, document)) names.add(name)
  }
  return names
}

function auditSourceTypes(paths: Paths, document: unknown) {
  const file = new URL('../../tsconfig.json', import.meta.url).pathname
  const config = ts.readConfigFile(file, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, new URL('../../', import.meta.url).pathname)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const checker = program.getTypeChecker()
  let bodies = 0, queries = 0
  for (const source of program.getSourceFiles()) {
    if (!source.fileName.includes('/src/routes/') || source.fileName.endsWith('.test.ts')) continue
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const method = node.expression.name.text
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) return ts.forEachChild(node, visit)
        const url = node.arguments[0].text.replace(/:([\w]+)/g, '{$1}')
        const operation = paths[url]?.[method]
        const typeNode = node.typeArguments?.[0]
        if (operation && typeNode) {
          const type = checker.getTypeFromTypeNode(typeNode)
          const body = type.getProperty('Body')
          if (body) {
            assert.ok(operation.requestBody || operation['x-aperture-input-validation'], `TypeScript-only body: ${method} ${url}`)
            const declared = body.valueDeclaration ?? body.declarations?.[0]
            assert.ok(declared)
            const requestBody = operation.requestBody as { content?: Record<string, { schema?: unknown }> } | undefined
            if (requestBody?.content) {
              const names = propertyNames(Object.values(requestBody.content)[0]?.schema, document)
              for (const field of checker.getTypeOfSymbolAtLocation(body, declared).getProperties()) {
                assert.ok(names.has(field.name), `Undeclared body field: ${method} ${url} ${field.name}`)
              }
            }
            bodies++
          }
          const query = type.getProperty('Querystring')
          if (query) {
            const declaration = query.valueDeclaration ?? query.declarations?.[0]
            assert.ok(declaration)
            const fields = checker.getTypeOfSymbolAtLocation(query, declaration).getProperties()
            const documented = new Set(operation.parameters?.filter(p => p.in === 'query').map(p => p.name))
            for (const field of fields) assert.ok(documented.has(field.name), `TypeScript-only query: ${method} ${url} ${field.name}`)
            queries += fields.length
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.ok(bodies > 50 && queries > 100, 'Source inventory must cover the complete API')
  return { bodies, queries }
}

test('all HTTP mutations have explicit validation and source-declared inputs have runtime contracts', { timeout: 30000 }, async t => {
  process.env.NODE_ENV = 'production'
  process.env.SESSION_SECRET ??= 'schema-audit-fixture-not-a-production-secret'
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
  const { buildServer } = await import('../server.js')
  const { closePool } = await import('@aperture/core')
  const { bodyContracts, requestContractsPlugin } = await import('./register.js')
  const app = await buildServer({ logger: false, schemaAudit: true })
  try {
    await app.ready()
    const document = app.swagger()
    const paths = document.paths as Paths
    const libraryImage = paths['/api/setup/library-image/{libraryType}'].post.requestBody as { content: Record<string, unknown> }
    assert.ok(libraryImage.content['application/json'])
    let mutations = 0
    for (const [url, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!['post', 'put', 'patch', 'delete'].includes(method)) continue
        assert.ok(operation.requestBody || operation['x-aperture-input-validation'], `Unvalidated mutation: ${method} ${url}`)
        mutations++
      }
    }
    const inventory = auditSourceTypes(paths, document)
    console.info(`Audited ${mutations} mutation contracts, ${inventory.bodies} source body types and ${inventory.queries} query fields`)

    await t.test('every migrated body rejects malformed payloads before authentication or effects', async () => {
      for (const key of Object.keys(bodyContracts)) {
        const [method, template] = key.split(' ')
        const path = template.replace(/:([\w]+)/g, '{$1}')
        const operation = paths[path][method.toLowerCase()]
        const url = template.replace(/:([\w]+)/g, (_match, name: string) => {
          const schema = operation.parameters?.find(p => p.in === 'path' && p.name === name)?.schema
          return encodeURIComponent(String(schema?.enum?.[0] ?? (schema?.type === 'integer' ? 1 : randomUUID())))
        })
        const response = await app.inject({ method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE', url, payload: [] })
        assert.equal(response.statusCode, 400, key)
        assert.equal(response.json().code, 'INVALID_REQUEST', key)
      }
    })
    await t.test('query validation rejects repeated scalars and non-numeric limits while retaining valid requests', async () => {
      for (const url of ['/api/similarity/search?q=film&limit=NaN', '/api/similarity/search?q=one&q=two', '/api/users/a/watch-history?page=0']) {
        assert.equal((await app.inject(url)).statusCode, 400, url)
      }
      assert.equal((await app.inject('/api/similarity/search?q=film&limit=12')).statusCode, 401)
      assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout' })).statusCode, 200)
      assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', payload: { unexpected: true } })).statusCode, 400)
      assert.equal((await app.inject({ method: 'POST', url: '/api/backup/upload', payload: {} })).statusCode, 401)
      const legacy = await app.inject({ method: 'POST', url: '/api/auth/login', payload: [] })
      assert.equal(legacy.statusCode, 400)
      assert.equal(legacy.json().code, 'FST_ERR_VALIDATION')
    })
    await t.test('a new mutation cannot silently ship without a contract', async () => {
      const fixture = Fastify()
      fixture.register(requestContractsPlugin)
      fixture.register(async instance => { instance.post('/api/unclassified-fixture', async () => ({ ok: true })) })
      try { await assert.rejects(async () => { await fixture.ready() }, /Missing explicit HTTP request contract/) }
      finally { await fixture.close() }
    })
    await t.test('Zod defaults and transforms reach handlers without losing existing query fields', async () => {
      const fixture = Fastify({ ajv: { customOptions: { keywords: ['example'] } } })
      fixture.register(requestContractsPlugin)
      fixture.register(async instance => {
        instance.post('/api/assistant/conversations', async request => request.body)
        instance.get('/api/users/:id/watch-history', { schema: { querystring: { type: 'object', properties: { existing: { type: 'string' } } } } }, async request => request.query)
        instance.post('/api/graph-playlists/ai-name', async request => request.body)
        instance.post('/api/channels/:id/items', async request => request.body)
      })
      try {
        assert.deepEqual((await fixture.inject({ method: 'POST', url: '/api/assistant/conversations' })).json(), {})
        assert.deepEqual((await fixture.inject('/api/users/a/watch-history?existing=retained&page=2')).json(), { existing: 'retained', page: '2' })
        const id = randomUUID()
        assert.deepEqual((await fixture.inject({ method: 'POST', url: '/api/graph-playlists/ai-name', payload: { movieIds: [id] } })).json(), { movieIds: [id], seriesIds: [] })
        assert.equal((await fixture.inject({ method: 'POST', url: '/api/graph-playlists/ai-name', payload: {} })).statusCode, 400)
        assert.deepEqual((await fixture.inject({ method: 'POST', url: `/api/channels/${id}/items`, payload: { itemIds: ['1042', 'provider-opaque-id'] } })).json(), { itemIds: ['1042', 'provider-opaque-id'] })
      } finally { await fixture.close() }
    })
  } finally { await app.close(); await closePool() }
})
