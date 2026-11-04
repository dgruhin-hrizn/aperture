interface Explanation {
  index: number
  explanation: string
}

export function parseExplanationResponse(content: string): Explanation[] {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = (fenced?.[1] ?? content).trim()
  const start = source.search(/[\[{]/)
  const json = start >= 0 ? source.slice(start) : source

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    // Repair escapes only inside quoted strings. Preserve valid JSON escapes
    // and retain unknown backslashes literally instead of dropping content.
    const repaired = json.replace(/"(?:[^"\\]|\\[\s\S])*"/g, (value) =>
      value.replace(/\\(?:u[0-9a-fA-F]{4}|[\s\S])/g, (escape) => {
        if (/^\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})$/.test(escape)) return escape
        if (escape === "\\'") return "'"
        return '\\' + escape
      })
    )
    parsed = JSON.parse(repaired)
  }
  const entries = Array.isArray(parsed) ? parsed : (parsed as { explanations?: unknown } | null)?.explanations
  return Array.isArray(entries) ? entries.filter((entry): entry is Explanation =>
    entry !== null && typeof entry === 'object' && Number.isInteger(entry.index)
    && typeof entry.explanation === 'string' && entry.explanation.trim().length > 0
  ) : []
}
