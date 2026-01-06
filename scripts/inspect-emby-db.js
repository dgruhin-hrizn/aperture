#!/usr/bin/env node

/**
 * Emby Database Inspector
 * 
 * Inspects the Emby SQLite database to check how Top Picks series are stored,
 * specifically looking at SortName, DateCreated, and other sorting-related fields.
 * 
 * Usage:
 *   node scripts/inspect-emby-db.js /path/to/library.db
 * 
 * On Unraid/Docker, the database is typically at:
 *   /mnt/user/appdata/emby/data/library.db
 * 
 * You may need to copy the database file first since Emby locks it:
 *   cp /mnt/user/appdata/emby/data/library.db /tmp/library.db
 *   node scripts/inspect-emby-db.js /tmp/library.db
 */

import Database from 'better-sqlite3'
import { resolve } from 'path'

const dbPath = process.argv[2]

if (!dbPath) {
  console.error(`
Usage: node scripts/inspect-emby-db.js <path-to-library.db>

Example:
  node scripts/inspect-emby-db.js /tmp/library.db

On Unraid, first copy the database (Emby locks the file):
  cp /mnt/user/appdata/emby/data/library.db /tmp/library.db
`)
  process.exit(1)
}

const resolvedPath = resolve(dbPath)
console.log(`\n📂 Opening database: ${resolvedPath}\n`)

let db
try {
  db = new Database(resolvedPath, { readonly: true })
} catch (err) {
  console.error(`❌ Failed to open database: ${err.message}`)
  console.error(`\nMake sure the file exists and is not locked by Emby.`)
  console.error(`Try copying it first: cp <emby-db-path> /tmp/library.db`)
  process.exit(1)
}

// Check database schema
console.log('📋 Checking database schema...\n')

const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all()

console.log('Tables found:', tables.map(t => t.name).join(', '))
console.log('')

// Check if TypedBaseItems exists
const hasTypedBaseItems = tables.some(t => t.name === 'TypedBaseItems')
if (!hasTypedBaseItems) {
  console.error('❌ TypedBaseItems table not found. This may not be an Emby database.')
  process.exit(1)
}

// Get column info for TypedBaseItems
const columns = db.prepare(`PRAGMA table_info(TypedBaseItems)`).all()
console.log('TypedBaseItems columns:', columns.map(c => c.name).join(', '))
console.log('')

// Search for Top Picks series
console.log('🔍 Searching for Top Picks series...\n')

const topPicksSeries = db.prepare(`
  SELECT 
    guid,
    Name,
    SortName,
    Path,
    DateCreated,
    DateModified,
    PremiereDate,
    Type,
    SeriesName
  FROM TypedBaseItems 
  WHERE Path LIKE '%top-picks%' 
     OR Path LIKE '%Top Picks%'
     OR Path LIKE '%Top 10%'
  ORDER BY DateCreated DESC
  LIMIT 50
`).all()

if (topPicksSeries.length === 0) {
  console.log('No Top Picks items found. Searching for all TV series...\n')
  
  const allSeries = db.prepare(`
    SELECT 
      guid,
      Name,
      SortName,
      Path,
      DateCreated,
      DateModified,
      Type
    FROM TypedBaseItems 
    WHERE Type = 'Series'
    ORDER BY DateCreated DESC
    LIMIT 20
  `).all()
  
  console.log(`Found ${allSeries.length} series (showing latest 20):\n`)
  allSeries.forEach((item, i) => {
    console.log(`${i + 1}. ${item.Name}`)
    console.log(`   SortName: ${item.SortName}`)
    console.log(`   DateCreated: ${item.DateCreated}`)
    console.log(`   Path: ${item.Path}`)
    console.log('')
  })
} else {
  console.log(`Found ${topPicksSeries.length} Top Picks items:\n`)
  
  topPicksSeries.forEach((item, i) => {
    console.log(`${i + 1}. ${item.Name} (${item.Type})`)
    console.log(`   SortName: ${item.SortName}`)
    console.log(`   DateCreated: ${item.DateCreated}`)
    console.log(`   DateModified: ${item.DateModified}`)
    console.log(`   PremiereDate: ${item.PremiereDate}`)
    console.log(`   Path: ${item.Path}`)
    console.log('')
  })
}

// Also check for any libraries with "Top" in the name
console.log('\n📚 Searching for Top Picks libraries...\n')

const libraries = db.prepare(`
  SELECT 
    guid,
    Name,
    SortName,
    Path,
    Type,
    DateCreated
  FROM TypedBaseItems 
  WHERE Type IN ('CollectionFolder', 'Folder', 'UserRootFolder')
    AND (Name LIKE '%Top%' OR Path LIKE '%top%')
  ORDER BY Name
`).all()

if (libraries.length > 0) {
  console.log(`Found ${libraries.length} potential Top Picks libraries:\n`)
  libraries.forEach((lib) => {
    console.log(`- ${lib.Name} (${lib.Type})`)
    console.log(`  Path: ${lib.Path}`)
    console.log('')
  })
} else {
  console.log('No Top Picks libraries found.\n')
}

// Check user display preferences
console.log('\n⚙️  Checking for display/sort preferences...\n')

const hasDisplayPrefs = tables.some(t => t.name === 'DisplayPreferences' || t.name === 'UserData')

if (hasDisplayPrefs) {
  try {
    const prefs = db.prepare(`
      SELECT * FROM DisplayPreferences 
      LIMIT 5
    `).all()
    
    if (prefs.length > 0) {
      console.log('Sample DisplayPreferences entries:')
      prefs.forEach(p => console.log(JSON.stringify(p, null, 2)))
    }
  } catch (e) {
    console.log('Could not query DisplayPreferences:', e.message)
  }
}

// Summary
console.log('\n' + '='.repeat(60))
console.log('📊 SUMMARY')
console.log('='.repeat(60))
console.log(`
To fix sort order issues, you have these options:

1. VERIFY NFO IS BEING READ:
   - Check if SortName matches what you set in <sorttitle>
   - Check if DateCreated matches your <dateadded>

2. FORCE METADATA REFRESH IN EMBY:
   - Library Settings → Manage Library → Refresh Metadata (Replace all)
   
3. MANUAL DATABASE FIX (risky, backup first!):
   Stop Emby first, then:
   
   sqlite3 /path/to/library.db
   
   -- Check current values
   SELECT Name, SortName, DateCreated 
   FROM TypedBaseItems 
   WHERE Path LIKE '%top-picks/series%';
   
   -- Update SortName to force rank order (01, 02, etc prefix)
   -- UPDATE TypedBaseItems SET SortName = '01 - ' || Name WHERE ...
   
   -- Or update DateCreated to force date order
   -- UPDATE TypedBaseItems SET DateCreated = datetime('now', '-X days') WHERE ...

4. HOME SCREEN WIDGET LIMITATION:
   - Emby's "Latest" widgets sort by DateCreated, not SortName
   - SortName only works when manually selecting "Sort by Name"
   - Our dateadded staggering should work for "Latest" widgets
`)

db.close()
console.log('\n✅ Done!\n')

