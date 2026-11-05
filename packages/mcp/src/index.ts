#!/usr/bin/env node
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Server } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'

const baseUrl = process.env.APERTURE_URL
const token = process.env.APERTURE_MCP_TOKEN
if (!baseUrl || !token) throw new Error('Set APERTURE_URL and APERTURE_MCP_TOKEN before starting the Aperture MCP bridge')
const endpoint = new URL(`${baseUrl.replace(/\/$/, '')}/mcp`)
if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('APERTURE_URL must be an HTTP(S) URL without embedded credentials')
const remote = new Client({ name: 'aperture-stdio-bridge', version: '0.8.0-dev.8' })
await remote.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
const handle = serveStdio(() => {
  const server = new Server({ name: 'Aperture', version: '0.8.0-dev.8' }, { capabilities: { tools: {} },
    instructions: 'Aperture exposes your accessible media, preferences and sourced release schedules. Only data sent to Aperture memory tools is retained from this client.' })
  server.setRequestHandler('tools/list', async () => remote.listTools())
  server.setRequestHandler('tools/call', async (request) => remote.callTool(request.params))
  return server
}, { onerror: (error) => process.stderr.write(`Aperture MCP: ${error.message}\n`) })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void handle.close().finally(() => remote.close()) })
process.stdin.once('end', () => { void remote.close() })
