// Keep the key aligned with the migration backfill and the title/year deduplication.
export function suggestionTitleKeySql(title: string, year: string): string {
  return `lower(${title}) || '|' || COALESCE(NULLIF(${year}, 0)::text, 'unknown')`
}
