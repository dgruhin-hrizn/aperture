#!/bin/bash

# Emby Database Inspector
# 
# Inspects the Emby SQLite database to check how Top Picks series are stored.
#
# Usage:
#   ./scripts/inspect-emby-db.sh /path/to/library.db
#
# On Unraid, the database is typically at:
#   /mnt/user/appdata/emby/data/library.db
#
# IMPORTANT: Copy the database first since Emby locks it:
#   cp /mnt/user/appdata/emby/data/library.db /tmp/library.db
#   ./scripts/inspect-emby-db.sh /tmp/library.db

DB_PATH="$1"

if [ -z "$DB_PATH" ]; then
    echo ""
    echo "Usage: $0 <path-to-library.db>"
    echo ""
    echo "Example:"
    echo "  $0 /tmp/library.db"
    echo ""
    echo "On Unraid, first copy the database (Emby locks the file):"
    echo "  cp /mnt/user/appdata/emby/data/library.db /tmp/library.db"
    echo ""
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo "❌ File not found: $DB_PATH"
    exit 1
fi

echo ""
echo "📂 Opening database: $DB_PATH"
echo ""

echo "=========================================="
echo "🔍 TOP PICKS SERIES (searching by path)"
echo "=========================================="
echo ""

sqlite3 -header -column "$DB_PATH" "
SELECT 
    Name,
    SortName,
    substr(DateCreated, 1, 19) as DateCreated,
    Type
FROM TypedBaseItems 
WHERE (Path LIKE '%top-picks%' OR Path LIKE '%Top 10%' OR Path LIKE '%Top Picks%')
  AND Type = 'Series'
ORDER BY DateCreated DESC
LIMIT 15;
"

echo ""
echo "=========================================="
echo "📊 DETAILED VIEW (with paths)"
echo "=========================================="
echo ""

sqlite3 -header -column "$DB_PATH" "
SELECT 
    Name,
    SortName,
    substr(DateCreated, 1, 19) as DateCreated,
    Path
FROM TypedBaseItems 
WHERE (Path LIKE '%top-picks%' OR Path LIKE '%Top 10%' OR Path LIKE '%Top Picks%')
  AND Type = 'Series'
ORDER BY SortName ASC
LIMIT 15;
"

echo ""
echo "=========================================="
echo "📚 ALL LIBRARIES"
echo "=========================================="
echo ""

sqlite3 -header -column "$DB_PATH" "
SELECT 
    Name,
    Type,
    Path
FROM TypedBaseItems 
WHERE Type IN ('CollectionFolder')
ORDER BY Name;
"

echo ""
echo "=========================================="
echo "📋 COMPARISON: SortName vs DateCreated order"
echo "=========================================="
echo ""

echo "BY SORTNAME (what 'Sort by Name' uses):"
sqlite3 "$DB_PATH" "
SELECT '  ' || SortName || ' → ' || substr(DateCreated, 1, 10)
FROM TypedBaseItems 
WHERE (Path LIKE '%top-picks%' OR Path LIKE '%Top 10%' OR Path LIKE '%Top Picks%')
  AND Type = 'Series'
ORDER BY SortName ASC
LIMIT 10;
"

echo ""
echo "BY DATECREATED (what 'Latest' widgets use):"
sqlite3 "$DB_PATH" "
SELECT '  ' || substr(DateCreated, 1, 10) || ' → ' || Name
FROM TypedBaseItems 
WHERE (Path LIKE '%top-picks%' OR Path LIKE '%Top 10%' OR Path LIKE '%Top Picks%')
  AND Type = 'Series'
ORDER BY DateCreated DESC
LIMIT 10;
"

echo ""
echo "=========================================="
echo "💡 WHAT TO CHECK"
echo "=========================================="
echo "
1. Does SortName show '01 - SeriesName', '02 - SeriesName', etc?
   - If not, Emby isn't reading <sorttitle> from your NFO files
   - Try: Refresh metadata with 'Replace all metadata'

2. Does DateCreated show staggered dates (1 day apart)?
   - If not, Emby isn't reading <dateadded> from your NFO files
   - The 'Latest' home widgets sort by DateCreated

3. If both look correct but sort is still wrong:
   - Emby might be caching old display order
   - Try clearing Emby cache or restart Emby server
"

echo ""
echo "=========================================="
echo "🔧 MANUAL FIX (if needed)"
echo "=========================================="
echo "
To manually fix DateCreated for proper rank ordering:

1. STOP EMBY FIRST!

2. Run these SQL commands:
   sqlite3 $DB_PATH

   -- View current state
   SELECT Name, SortName, DateCreated 
   FROM TypedBaseItems 
   WHERE Path LIKE '%top-picks/series%' AND Type='Series';

   -- Fix DateCreated to be 1 day apart (rank 1 = newest)
   -- This is a template - adjust the WHERE clause for your paths

3. Restart Emby
"

echo ""
echo "✅ Done!"
echo ""



