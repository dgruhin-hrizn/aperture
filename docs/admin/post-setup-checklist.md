# Post-Setup Checklist

After completing the Setup Wizard, follow this checklist to get Aperture fully operational.

## Quick Start Checklist

| Step | Action | Location |
|------|--------|----------|
| 1 | Verify libraries synced | Admin → Jobs |
| 2 | Check embeddings generated | Admin → Jobs |
| 3 | Enable users for recommendations | Admin → Users |
| 4 | Generate recommendations | Admin → Jobs |
| 5 | Build Aperture libraries | Admin → Jobs |
| 6 | Verify in media server | Emby/Jellyfin |

---

## Step 1: Verify Libraries Synced

Navigate to **Admin → Jobs**

### Check Movie Sync

Look for `sync-movies` job:
- **Status:** Completed
- **Result:** "Synced X movies"
- **No errors** in logs

### Check Series Sync

Look for `sync-series` job:
- **Status:** Completed
- **Result:** "Synced X series, Y episodes"
- **No errors** in logs

### If Sync Failed

Common issues:

| Error | Solution |
|-------|----------|
| Connection refused | Check media server URL |
| Unauthorized | Verify API key |
| Empty library | Enable libraries in Settings |

Re-run the sync job after fixing.

---

## Step 2: Check Embeddings Generated

Navigate to **Admin → Jobs**

### Check Embedding Jobs

Look for:
- `generate-movie-embeddings` — Completed
- `generate-series-embeddings` — Completed

### Verify Count

Jobs should show embeddings generated matching your library size.

### If Embeddings Failed

Common issues:

| Error | Solution |
|-------|----------|
| API key invalid | Check OpenAI/AI provider key |
| Rate limited | Wait and retry |
| Timeout | Reduce batch size in settings |

---

## Step 3: Enable Users for Recommendations

Navigate to **Admin → Users**

### For Each User

1. Click the user row to expand
2. Toggle **Movies** ON for movie recommendations
3. Toggle **Series** ON for series recommendations
4. Repeat for all users who should receive recommendations

### Sync New Users

If users are missing:
1. Click **Sync Users** button
2. Wait for sync to complete
3. New users appear in the list

### User Requirements

For recommendations to work, users need:
- Watch history (at least some watched items)
- Enabled for recommendations
- Library access in media server

---

## Step 4: Generate Recommendations

Navigate to **Admin → Jobs**

### Run Recommendation Jobs

1. Click **Run** on `generate-movie-recommendations`
2. Wait for completion
3. Click **Run** on `generate-series-recommendations`
4. Wait for completion

### What Happens

For each enabled user:
- Analyzes watch history
- Computes taste profile
- Scores all unwatched content
- Generates personalized rankings

### Duration

| Users | Library Size | Approximate Time |
|-------|--------------|------------------|
| 1-5 | Small | 1-5 minutes |
| 1-5 | Large | 5-15 minutes |
| 10+ | Large | 15-30+ minutes |

---

## Step 5: Build Aperture Libraries

Navigate to **Admin → Jobs**

### Run Library Build Jobs

1. Click **Run** on `sync-movie-libraries` (Build Aperture Movie Libraries)
2. Wait for completion
3. Click **Run** on `sync-series-libraries` (Build Aperture Series Libraries)
4. Wait for completion

### What Happens

- Creates STRM files or symlinks
- Generates NFO metadata files
- Creates folder structure
- Triggers media server library scan

### Verify Output

Check the configured output directory:
```
/aperture-libraries/
├── users/
│   └── username/
│       ├── ai-movies/
│       └── ai-series/
└── shared/
    └── top-picks/
```

---

## Step 6: Verify in Media Server

### Emby/Jellyfin

1. Open your media server dashboard
2. Go to **Libraries** section
3. Look for new libraries:
   - "AI Picks - Username - Movies"
   - "AI Picks - Username - Series"

### If Libraries Don't Appear

1. Check library was created in output directory
2. Verify path mappings in Aperture settings
3. Manually add library in media server pointing to output path
4. Trigger library scan

### Test Playback

1. Navigate to the AI Picks library
2. Select any recommendation
3. Click Play
4. Verify video plays correctly

If playback fails, check path mappings.

---

## Configure Job Schedules

Navigate to **Admin → Jobs**

### Recommended Schedule

| Job | Recommended Schedule |
|-----|---------------------|
| Database Backup | Daily at 1 AM |
| Sync Movies/Series | Daily at 2 AM |
| Watch History Sync | Every 2 hours |
| Embeddings | Daily at 3 AM |
| Recommendations | Weekly (Sunday 4 AM) |
| Library Build | Weekly (Sunday 5 AM) |
| Top Picks | Daily at 5 AM |

### Setting Schedules

1. Click the **gear icon** on any job
2. Select schedule type (Daily, Weekly, Interval, Manual)
3. Set the time or interval
4. Click Save

---

## Optional: Configure Integrations

Navigate to **Admin → Settings → Setup → Integrations**

### Recommended Integrations

| Integration | Purpose | Priority |
|-------------|---------|----------|
| **TMDb** | Metadata enrichment | High |
| **Trakt** | Rating sync | Medium |
| **MDBList** | Top Picks source | Optional |
| **Jellyseerr** | Discovery requests | Optional |

See [Integrations Overview](integrations-overview.md) for setup details.

---

## Optional: Configure Top Picks

Navigate to **Admin → Settings → Top Picks**

If you want global trending libraries:

1. Enable Top Picks
2. Choose source (Local, MDBList, Hybrid)
3. Configure output format
4. Run `refresh-top-picks` job

See [Top Picks Configuration](top-picks.md) for details.

---

## Troubleshooting

### No Recommendations Appearing

1. Check user is enabled for recommendations
2. Verify recommendations job completed
3. Verify library build job completed
4. Check path mappings
5. Trigger media server library scan

### Recommendations Seem Wrong

1. Verify watch history synced correctly
2. Check algorithm weights in Settings
3. Run embeddings job if content was added
4. Re-run recommendations after changes

### Libraries Not Updating

1. Check job schedules are set
2. Verify jobs are completing without errors
3. Check available disk space
4. Review job logs for issues

---

## Next Steps

Once everything is working:

1. **Fine-tune algorithm** — [Algorithm Tuning](algorithm-tuning.md)
2. **Configure AI features** — [AI Explanations](ai-explanations.md)
3. **Set up Top Picks** — [Top Picks](top-picks.md)
4. **Review workflows** — [Recommended Workflow](recommended-workflow.md)

---

**Previous:** [Setup Wizard](setup-wizard.md) | **Next:** [Media Server Configuration](media-server.md)
