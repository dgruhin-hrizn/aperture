# Setup Wizard

The Setup Wizard guides you through initial Aperture configuration in 11 steps. It appears automatically on first access or can be re-run from Admin Settings.

## Accessing the Wizard

- **First time:** Automatically shown when accessing Aperture
- **Re-run:** Admin → Settings → Setup → "Re-run Setup Wizard" button

---

## Step 1: Restore (Optional)

Restore from an existing backup if migrating or recovering.

### Options

| Option | Description |
|--------|-------------|
| **Upload backup** | Select a backup file from your computer |
| **Select existing** | Choose from backups in the `/backups` volume |
| **Skip** | Start fresh with no data |

### When to Use

- Migrating Aperture to a new server
- Recovering from data loss
- Restoring a known-good state

### What Gets Restored

- All user data and preferences
- Watch history
- Ratings
- Recommendations
- Job schedules
- Settings

**Skip this step** if starting fresh.

---

## Step 2: Media Server Connection

Connect Aperture to your Emby or Jellyfin server.

### Configuration

| Field | Description |
|-------|-------------|
| **Server Type** | Emby or Jellyfin |
| **Server URL** | Full URL including port (e.g., `http://192.168.1.100:8096`) |
| **API Key** | Admin API key from your media server |

### Getting Your API Key

**Emby:**
1. Open Emby Dashboard
2. Navigate to **Advanced → API Keys**
3. Click **New API Key**
4. Name it "Aperture"
5. Copy the generated key

**Jellyfin:**
1. Open Jellyfin Dashboard
2. Navigate to **Dashboard → API Keys**
3. Click **Add**
4. Name it "Aperture"
5. Copy the generated key

### Testing Connection

1. Enter your details
2. Click **Test Connection**
3. Green checkmark = success
4. Red X = check URL and API key

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check URL and port |
| Unauthorized | Verify API key is correct |
| Timeout | Check network/firewall |
| SSL error | Use http:// or configure certificates |

---

## Step 3: Source Libraries

Select which libraries Aperture should analyze for recommendations.

### Configuration

Toggle ON/OFF for each library:

| Library Type | What Happens When Enabled |
|--------------|---------------------------|
| **Movies** | Movies synced, embeddings generated, recommendations created |
| **TV Shows** | Series synced, embeddings generated, recommendations created |

### Best Practices

- **Enable:** Main movie and TV libraries
- **Disable:** Kids libraries (unless you want those recommendations)
- **Disable:** Music videos, home videos, etc.

### Multiple Libraries

If you have multiple movie libraries (e.g., "Movies", "4K Movies"):
- Enable all you want in recommendations
- Aperture deduplicates automatically

---

## Step 4: File Locations

Configure path mappings for symlinks to work correctly.

### The Challenge

Aperture and your media server may see files at different paths:
- Media server: `/mnt/Movies/Film.mkv`
- Aperture container: `/media/Movies/Film.mkv`

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Aperture Libraries Path** | Where media server sees Aperture's output | `/mnt/ApertureLibraries/` |
| **Media Server Path Prefix** | Base path for media in media server | `/mnt/` |

### Auto-Detection

Click **Auto-Detect Paths** to automatically configure:
1. Fetches sample file from media server
2. Compares to Aperture's view
3. Calculates correct prefix

### Common Configurations

**Unraid:**
```
Aperture Libraries Path: /mnt/ApertureLibraries/
Media Server Path Prefix: /mnt/
```

**Synology:**
```
Aperture Libraries Path: /volume1/docker/aperture/libraries/
Media Server Path Prefix: /volume1/
```

**Standard Docker:**
```
Aperture Libraries Path: /data/ApertureLibraries/
Media Server Path Prefix: /data/
```

### Skip Option

If using STRM files (not symlinks), path mapping is less critical. You can skip and adjust later.

---

## Step 5: AI Recommendations

Configure library naming and cover images.

### Library Names

Set default templates for AI recommendation libraries:

| Template | Example Output |
|----------|----------------|
| `{{username}}'s AI Picks - {{type}}` | "John's AI Picks - Movies" |
| `AI Recommendations for {{username}}` | "AI Recommendations for John" |

### Available Merge Tags

| Tag | Value |
|-----|-------|
| `{{username}}` | User's display name |
| `{{type}}` | "Movies" or "TV Series" |
| `{{count}}` | Number of recommendations |
| `{{date}}` | Date of last generation |

### Library Images

Upload custom banner images (optional):

| Library | Recommended Size |
|---------|------------------|
| AI Movies | 1920×1080 (16:9) |
| AI Series | 1920×1080 (16:9) |

Leave blank to use defaults.

---

## Step 6: Validate

Review and verify your output configuration.

### Output Format Selection

| Format | Description | Best For |
|--------|-------------|----------|
| **STRM** | Text files with streaming URLs | Universal compatibility |
| **Symlinks** | Filesystem links to originals | Same filesystem setups |

### Validation Checks

The wizard verifies:
- Path mappings are valid
- Output directory is writable
- Media server can access the output path

### Fix Issues

If validation fails:
- Go back and adjust paths
- Check Docker volume mounts
- Verify permissions

---

## Step 7: Users

Select which users receive AI recommendations.

### User List

All users from your media server appear. For each user:

| Toggle | Effect |
|--------|--------|
| **Movies** | Enable movie recommendations |
| **Series** | Enable series recommendations |

### Considerations

- Users need **watch history** for recommendations to work
- New users can be enabled later
- Admin users can also receive recommendations

### Bulk Actions

- **Enable All:** Quick enable for all users
- **Disable All:** Start with none enabled

---

## Step 8: Top Picks (Optional)

Configure global trending content libraries.

### Enable/Disable

Toggle Top Picks on or off. Can be configured in detail later.

### Quick Configuration

| Setting | Options |
|---------|---------|
| **Source** | Local watch data, MDBList, or Hybrid |
| **Output** | Library, Collection, Playlist |
| **Count** | Number of items (default: 50) |

### Skip

Top Picks is optional. Skip to configure later or leave disabled.

See [Top Picks Configuration](top-picks.md) for full details.

---

## Step 9: AI / LLM Setup

Configure your AI provider and API key.

### Provider Selection

| Provider | Setup |
|----------|-------|
| **OpenAI** | API key from platform.openai.com |
| **Ollama** | Local URL (http://host:11434) |
| **Groq** | API key from groq.com |
| **Others** | OpenAI-compatible endpoints |

### OpenAI Setup

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Enter key in the field
3. Click **Test Key**
4. Green checkmark = success

### Skip Option

You can skip AI setup and configure later, but:
- Embeddings won't generate
- Recommendations won't work
- AI features disabled

### What AI Powers

| Feature | Requires AI |
|---------|-------------|
| Embeddings | Yes |
| Recommendations | Yes |
| Explanations | Yes |
| Encore chatbot | Yes |
| Top Picks | No (uses watch data) |

---

## Step 10: Initial Jobs

Run first-time sync jobs with real-time progress.

### Automatic Jobs

The wizard runs these jobs in sequence:

1. **Sync Movies** — Import movies from libraries
2. **Sync Series** — Import TV series and episodes
3. **Generate Movie Embeddings** — Create AI vectors
4. **Generate Series Embeddings** — Create AI vectors
5. **Sync Watch History** — Import viewing data

### Progress Display

Each job shows:
- Real-time progress bar
- Current status message
- Time elapsed
- Errors (if any)

### Re-running Jobs

If a job fails:
- Click **Retry** on that job
- Or skip and run manually later from Admin → Jobs

### Duration

First-time sync depends on library size:

| Library Size | Approximate Time |
|--------------|------------------|
| Small (<500) | 5-15 minutes |
| Medium (500-2000) | 15-45 minutes |
| Large (2000+) | 45+ minutes |

Embeddings are the slowest part.

---

## Step 11: Complete

Setup is finished! Review what was created.

### Summary

The wizard shows:
- Libraries created
- Users configured
- Jobs scheduled
- Next steps

### What's Ready

After completing setup:
- Movies and series are synced
- Embeddings are generated
- Watch history is imported
- Default job schedules are set

### Next Steps

1. **Generate Recommendations** — Run from Admin → Jobs
2. **Build Libraries** — Creates virtual libraries in media server
3. **Configure Schedules** — Adjust job timing as needed
4. **Fine-tune Settings** — Explore Admin → Settings

### Re-running the Wizard

You can re-run the wizard anytime from Admin → Settings to:
- Reconfigure media server
- Change path mappings
- Reset settings

---

**Next:** [Post-Setup Checklist](post-setup-checklist.md)
