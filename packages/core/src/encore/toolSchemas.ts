import { asSchema, type ToolSet } from 'ai'

type ToolInputSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>

/** Validate the public wire contract before sending any tool to a model or MCP client. */
export async function getEncoreToolSchemas(tools: ToolSet) {
  const schemas: Record<string, ToolInputSchema> = {}
  for (const [name, definition] of Object.entries(tools)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new Error(`Invalid Encore tool name: ${name}`)
    const schema = await asSchema(definition.inputSchema).jsonSchema
    if (schema.type !== 'object' || schema.anyOf || schema.oneOf)
      throw new Error(
        `Invalid Encore input schema for ${name}: an object root without a top-level union is required`
      )
    schemas[name] = schema
  }
  return schemas
}
