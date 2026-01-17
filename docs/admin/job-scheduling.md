# Job Scheduling

Configure when background jobs run automatically.

## Accessing Schedules

Navigate to **Admin → Jobs**, then click the **gear icon** on any job.

---

## Schedule Types

### Daily

Run at the same time every day.

| Setting | Example |
|---------|---------|
| **Time** | 2:00 AM |
| **Runs** | Every day at 2:00 AM |

Best for: Regular maintenance, sync jobs

### Weekly

Run on a specific day and time.

| Setting | Example |
|---------|---------|
| **Day** | Sunday |
| **Time** | 4:00 AM |
| **Runs** | Every Sunday at 4:00 AM |

Best for: Heavy jobs, recommendations

### Interval

Run every N hours.

| Setting | Example |
|---------|---------|
| **Hours** | 2 |
| **Runs** | Every 2 hours |

Options: 1, 2, 3, 4, 6, 8, 12 hours

Best for: Watch history, frequent updates

### Manual Only

No automatic schedule. Only runs when manually triggered.

Best for: One-time jobs, troubleshooting

---

## Default Schedules

| Job | Default Schedule |
|-----|------------------|
| **User Sync** | Every 30 minutes |
| **Database Backup** | Daily at 1:00 AM |
| **Library Scan** | Daily at 2:00 AM |
| **Watch History** | Every 2 hours |
| **Embeddings** | Daily at 3:00 AM |
| **Recommendations** | Weekly (Sunday 4:00 AM) |
| **Library Build** | Weekly (Sunday 5:00 AM) |
| **Top Picks** | Daily at 5:00 AM |
| **Enrichment** | Every 6 hours |
| **Discovery** | Daily at 6:00 AM |

---

## Configuring Schedules

### Steps

1. Navigate to Admin → Jobs
2. Find the job to configure
3. Click the **gear icon** (⚙️)
4. Select schedule type
5. Set parameters (time, day, interval)
6. Click **Save**

### Schedule Dialog

| Field | Description |
|-------|-------------|
| **Type** | Daily/Weekly/Interval/Manual |
| **Time** | Hour and minute (for Daily/Weekly) |
| **Day** | Day of week (for Weekly) |
| **Interval** | Hours between runs (for Interval) |

---

## Schedule Strategy

### Avoid Overlap

If jobs run simultaneously:
- One runs, others queue
- Can cause delays
- Stagger start times

Example:
- 2:00 AM - Sync Movies
- 2:30 AM - Sync Series
- 3:00 AM - Embeddings

### Consider Dependencies

Schedule dependent jobs after prerequisites:

```
2:00 AM - sync-movies
3:00 AM - generate-movie-embeddings (needs movies)
4:00 AM - generate-movie-recommendations (needs embeddings)
5:00 AM - sync-movie-libraries (needs recommendations)
```

### Respect Rate Limits

AI and external API jobs may hit rate limits:
- Space out API-heavy jobs
- Consider daily limits (OMDb)
- Monitor for rate limit errors

---

## Timing Considerations

### Time Zones

Schedules use server time zone:
- Check container timezone
- Set via environment variable
- Times shown in local server time

### Off-Peak Hours

Run heavy jobs during off-peak:
- Overnight (1 AM - 6 AM)
- When users aren't active
- Consider media server scan times

### Quick Jobs

Some jobs are fast and can run frequently:
- Watch history sync
- User sync
- Top Picks refresh

---

## Monitoring Scheduled Jobs

### Next Run

Jobs page shows:
- "Next run in X hours"
- "Scheduled for [time]"

### Missed Runs

If Aperture was down during scheduled time:
- Job runs as soon as possible
- Only one catch-up run
- Doesn't run multiple times

---

## Disabling Schedules

To stop automatic runs:

1. Click gear icon on job
2. Select "Manual Only"
3. Save

Job will only run when manually triggered.

---

## Recommended Configurations

### Small Library (<500 items)

| Job | Schedule |
|-----|----------|
| Sync | Daily at 2 AM |
| Embeddings | Daily at 3 AM |
| Recommendations | Daily at 4 AM |
| Library Build | Daily at 5 AM |

### Medium Library (500-2000)

| Job | Schedule |
|-----|----------|
| Sync | Daily at 2 AM |
| Embeddings | Daily at 3 AM |
| Recommendations | Weekly Sunday |
| Library Build | Weekly Sunday |

### Large Library (2000+)

| Job | Schedule |
|-----|----------|
| Sync | Daily at 1 AM |
| Embeddings | Weekly Saturday |
| Recommendations | Weekly Sunday |
| Library Build | After recommendations |

---

## Troubleshooting

### Job Not Running on Schedule

1. Check schedule is saved
2. Verify Aperture is running
3. Check server time/timezone
4. Look for queued state

### Jobs Taking Too Long

1. Check job isn't stalled
2. Review resource usage
3. Consider longer intervals
4. Run during quieter times

### Frequent Failures

1. Review error logs
2. Check prerequisites (API keys, etc.)
3. Verify network connectivity
4. Consider less frequent schedule

---

**Previous:** [Jobs Overview](jobs-overview.md) | **Next:** [Movie Jobs](movie-jobs.md)
