# Recommended Workflow

Best practices for operating Aperture efficiently.

![Admin Jobs](../images/admin/admin-jobs.png)

---

## Default Schedule

The optimized job schedule:

| Time | Jobs |
|------|------|
| 1:00 AM | Database backup |
| 2:00 AM | Sync movies, Sync series |
| 2:30 AM | Sync movie watch history |
| 3:00 AM | Sync series watch history, Embeddings |
| 4:00 AM | Recommendations (weekly) |
| 5:00 AM | Library builds (weekly), Top Picks |
| Every 2h | Watch history sync (incremental) |
| Every 6h | Metadata enrichment |
| Every 30m | User sync |

---

## Why This Order

### Backup First

- Protects data before any changes
- Can restore if something goes wrong
- Runs when system is quiet

### Sync Before Processing

- Fresh content for embeddings
- Current watch history for recommendations
- Accurate data throughout

### Weekly vs Daily

| Frequency | Jobs | Why |
|-----------|------|-----|
| **Daily** | Sync, Enrichment, Top Picks | Keep data current |
| **Weekly** | Recommendations, Library Builds | Computationally heavy |

---

## Daily Operations

### Automatic

These run without intervention:
- Watch history sync (every 2 hours)
- User sync (every 30 minutes)
- Top Picks refresh (daily)

### Monitor

Check daily:
- Job completion status
- Error alerts
- Unusual patterns

---

## Weekly Operations

### Recommendation Cycle

Sunday (default):
1. 4:00 AM - Generate recommendations
2. 5:00 AM - Build libraries

Users see fresh recommendations each week.

### Review

Weekly check:
- Job logs for errors
- User feedback
- Algorithm performance

---

## Post-Update Workflow

After adding significant new content:

### Steps

1. **Run sync jobs** - Import new content
2. **Run embeddings** - Generate vectors for new items
3. **Optional: Recommendations** - Include new content immediately
4. **Optional: Library build** - If recommendations updated

### When to Trigger

- Large batch of new movies/series
- New library added
- After media server maintenance

---

## Post-Upgrade Workflow

After updating Aperture:

### Steps

1. **Check release notes** - Note any breaking changes
2. **Verify jobs run** - Confirm scheduled jobs work
3. **Test integrations** - Check API connections
4. **Review new settings** - Configure new features

### If Issues

1. Check error logs
2. Review migration notes
3. Re-run failed jobs
4. Restore from backup if needed

---

## Algorithm Tuning Workflow

When adjusting recommendation algorithm:

### Steps

1. **Backup current settings** - Note current weights
2. **Make small changes** - One weight at a time
3. **Generate recommendations** - Run rec job
4. **Review results** - Check a few users
5. **Iterate** - Adjust and repeat

### Best Practices

- Change one weight at a time
- Test with subset of users first
- Give changes a week to evaluate
- Collect user feedback

---

## Troubleshooting Workflow

When something isn't working:

### Step 1: Identify

- What's not working?
- When did it start?
- Any recent changes?

### Step 2: Check Basics

- Is Aperture running?
- Is media server connected?
- Are API keys valid?

### Step 3: Check Jobs

- Any failed jobs?
- What do logs say?
- When did jobs last run?

### Step 4: Check Data

- Is content synced?
- Are embeddings generated?
- Is watch history current?

### Step 5: Test

- Run affected job manually
- Check results
- Verify fix

---

## Large Library Workflow

For libraries with 2000+ items:

### Initial Setup

1. Allow extra time for embedding generation
2. Consider running overnight
3. Monitor for rate limits

### Ongoing

| Adjustment | Why |
|------------|-----|
| Weekly recommendations | Daily too slow |
| Lower rec count per user | Reduce processing |
| Scheduled off-peak | Avoid user impact |

### Optimization

- Only sync changed content
- Use incremental watch history
- Prune old data periodically

---

## Multi-User Workflow

For servers with many users:

### Scaling

| Users | Recommendation Frequency |
|-------|-------------------------|
| 1-5 | Daily possible |
| 5-20 | Weekly recommended |
| 20+ | Weekly, consider batching |

### User Management

- Enable recommendations selectively
- Focus on active users
- Monitor per-user impact

---

## Maintenance Workflow

### Weekly

- [ ] Review job logs
- [ ] Check for errors
- [ ] Verify backup ran
- [ ] Spot-check recommendations

### Monthly

- [ ] Review storage usage
- [ ] Clean legacy embeddings
- [ ] Check API quotas
- [ ] Update integrations if needed

### Quarterly

- [ ] Review algorithm settings
- [ ] Evaluate recommendation quality
- [ ] Clean unused data
- [ ] Consider model upgrades

---

## Emergency Procedures

### Recommendations Broken

1. Check recommendation jobs completed
2. Verify embeddings exist
3. Check watch history synced
4. Re-run recommendation pipeline

### Data Corruption

1. Stop Aperture
2. Restore from backup
3. Re-run sync jobs
4. Regenerate recommendations

### API Key Compromised

1. Revoke key immediately at provider
2. Generate new key
3. Update in Aperture
4. Monitor for unusual usage

---

## Performance Tips

### General

- Run heavy jobs overnight
- Stagger job start times
- Monitor resource usage

### Database

- Let PostgreSQL manage itself
- Don't over-schedule backups
- Clean old data periodically

### API Usage

- Respect rate limits
- Use incremental sync
- Cache where possible

---

**Previous:** [API Errors](api-errors.md) | **Back to:** [Admin Guide](../admin-guide.md)
