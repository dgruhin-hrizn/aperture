# Library Title Templates

Configure default naming patterns for Aperture-created libraries.

## Accessing Settings

Navigate to **Admin → Settings → AI Recommendations → Output**

---

## What Gets Named

Aperture creates several library types:

| Library Type | Example |
|--------------|---------|
| AI Movie Recommendations | "AI Picks - John - Movies" |
| AI Series Recommendations | "AI Picks - John - Series" |
| Top Picks Movies | "Top Movies This Week" |
| Top Picks Series | "Top Series This Week" |
| Shows You Watch | "Shows You Watch - John" |

---

## Template System

Use merge tags to create dynamic names.

### Available Merge Tags

| Tag | Description | Example Output |
|-----|-------------|----------------|
| `{{username}}` | User's display name | "John" |
| `{{type}}` | Media type | "Movies" or "TV Series" |
| `{{count}}` | Number of items | "50" |
| `{{date}}` | Last generation date | "2025-01-15" |

### Template Examples

| Template | Result |
|----------|--------|
| `{{username}}'s AI Picks - {{type}}` | "John's AI Picks - Movies" |
| `AI Recommendations for {{username}}` | "AI Recommendations for John" |
| `{{username}} Picks ({{count}} {{type}})` | "John Picks (50 Movies)" |
| `Aperture {{type}} - {{username}}` | "Aperture Movies - John" |

---

## Configuration

### Movie Library Template

Default: `AI Picks - {{username}} - Movies`

### Series Library Template

Default: `AI Picks - {{username}} - TV Series`

### Applying Changes

1. Edit templates
2. Click Save
3. Re-run library build jobs
4. Libraries renamed in media server

---

## User Overrides

Users can set their own library names:

### Where Users Configure

User Settings → Preferences → Library Names

### Priority

1. User's custom name (if set)
2. Admin template with tags expanded
3. Fallback to default

### Encouraging Custom Names

Users might want custom names for:
- Multi-language households
- Personal branding
- Shorter names for mobile display

---

## Top Picks Names

Top Picks libraries have separate naming:

### Configuration

Navigate to Admin → Settings → Top Picks

### Templates

| Setting | Default |
|---------|---------|
| Movies Library | "Top Picks - Movies" |
| Series Library | "Top Picks - Series" |
| Collection Name | "Top Movies This Week" |
| Playlist Name | "Top Movies This Week" |

---

## Shows You Watch Names

Configure in Admin → Settings → Shows You Watch:

| Setting | Default |
|---------|---------|
| Library Name | "Shows You Watch - {{username}}" |

---

## Best Practices

### Keep Names Short

Mobile apps truncate long names:

| Good | Bad |
|------|-----|
| "John's AI Picks" | "John's AI-Generated Personalized Movie Recommendations" |

### Be Consistent

Use similar patterns across library types:
- "AI Movies - John"
- "AI Series - John"
- "Top Movies"
- "Top Series"

### Consider Multi-User

If multiple users share a media server:
- Include username in template
- Make it clear whose library is whose

### Avoid Special Characters

Some characters may cause issues:
- Slashes (/)
- Colons (:)
- Asterisks (*)

Stick to letters, numbers, spaces, and dashes.

---

## Library Visibility

### In Media Server

Libraries appear in:
- Library list/menu
- Home screen (if pinned)
- Browse views

### Sorting

Libraries sort alphabetically. Consider prefixes:
- "! AI Picks" (appears first)
- "Z Top Picks" (appears last)

---

## Troubleshooting

### Name Not Updating

1. Check template saved correctly
2. Re-run library build job
3. Refresh library in media server
4. Check user hasn't overridden

### Tags Not Expanding

- Verify tag syntax: `{{username}}` not `{username}`
- Check tag name is exact (case-sensitive)
- Ensure value is available (user exists, etc.)

### Duplicate Names

If two users have same name:
- Names will conflict
- Consider adding user ID
- Or let users customize their own

---

**Previous:** [Output Format](output-format.md) | **Next:** [AI Explanations](ai-explanations.md)
