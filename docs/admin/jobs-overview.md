# Jobs Overview

Background jobs power Aperture's core functionality, from syncing media to generating recommendations.

## Accessing Jobs

Navigate to **Admin → Jobs**

---

## Job System Architecture

### How Jobs Work

1. Jobs run sequentially (one at a time)
2. Scheduled jobs queue when triggered
3. Manual jobs run immediately (or queue if busy)
4. Progress tracked in real-time
5. Results logged to database

### Job States

| State | Description |
|-------|-------------|
| **Idle** | Ready to run |
| **Running** | Currently executing |
| **Completed** | Finished successfully |
| **Failed** | Finished with errors |
| **Cancelled** | Stopped by user |
| **Queued** | Waiting to run |

---

## Job Categories

### Movie Jobs

Content sync and AI processing for movies:
- Sync movies from library
- Generate embeddings
- Sync watch history
- Generate recommendations
- Build virtual libraries

See [Movie Jobs](movie-jobs.md) for details.

### Series Jobs

Content sync and AI processing for TV series:
- Sync series from library
- Generate embeddings
- Sync watch history
- Generate recommendations
- Build virtual libraries

See [Series Jobs](series-jobs.md) for details.

### Global Jobs

Cross-content and system jobs:
- Metadata enrichment
- Top Picks refresh
- User library sync
- Integration sync
- Database backup
- Discovery generation

See [Global Jobs](global-jobs.md) for details.

---

## Jobs Page Interface

### Job Cards

Each job displays:
- Job name and icon
- Current status
- Last run time
- Next scheduled run
- Run/Cancel buttons

### Progress Display

When running:
- Progress bar with percentage
- Current operation description
- Elapsed time
- Items processed

### Actions

| Button | Action |
|--------|--------|
| **Run** | Start job immediately |
| **Cancel** | Stop running job |
| **Gear** | Configure schedule |
| **History** | View past runs |

---

## Running Jobs

### Manual Execution

1. Find job in list
2. Click **Run** button
3. Job starts (or queues)
4. Monitor progress
5. View results when complete

### Queued Jobs

If a job is already running:
- New jobs queue
- Run in order
- Queue visible in UI

### Priority

Jobs run first-come, first-served. No priority system.

---

## Job History

### Viewing History

1. Click **History** (clock icon) on job
2. Modal shows past runs
3. Each entry shows:
   - Start/end time
   - Duration
   - Status
   - Result summary

### Log Access

For detailed logs:
1. Click a history entry
2. Full logs displayed
3. Includes errors and warnings

---

## Error Handling

### Job Failures

When a job fails:
- Error logged
- Job marked as Failed
- Notification displayed (if enabled)
- Can retry immediately

### Partial Failures

Some jobs handle partial failures:
- Continue processing remaining items
- Log individual errors
- Report total success/fail count

### Automatic Retry

Jobs don't automatically retry on failure. Manual retry required.

---

## Job Dependencies

### Recommended Order

Some jobs should run before others:

```
sync-movies → generate-movie-embeddings → generate-movie-recommendations → sync-movie-libraries
```

### Independent Jobs

Some jobs can run in any order:
- Different content types (movies vs series)
- Different integrations
- Enrichment jobs

---

## Resource Considerations

### CPU/Memory

| Job Type | Resource Usage |
|----------|----------------|
| Sync | Light |
| Embeddings | Heavy (API calls) |
| Recommendations | Medium |
| Library Build | Light |

### Duration Estimates

| Job | Small Library | Large Library |
|-----|---------------|---------------|
| Sync | 1-5 min | 5-15 min |
| Embeddings | 5-30 min | 1-4 hours |
| Recommendations | 1-10 min | 10-30 min |
| Library Build | 1-5 min | 5-15 min |

---

## Best Practices

### Scheduling

- Stagger jobs to avoid overlap
- Run heavy jobs overnight
- Consider API rate limits

### Monitoring

- Review job logs weekly
- Check for recurring errors
- Monitor duration trends

### Troubleshooting

- Check logs for specific errors
- Verify prerequisites (API keys, etc.)
- Run manual test before scheduling

---

**Previous:** [Database Management](database-management.md) | **Next:** [Job Scheduling](job-scheduling.md)
