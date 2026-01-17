# API Errors

Understanding and resolving integration error alerts.

## Accessing Errors

Error alerts appear:
- In Admin → Settings → Integrations
- At the top of relevant settings pages
- In job logs

---

## Error Types

### Authentication Errors

| Indicator | Meaning |
|-----------|---------|
| **Severity:** Error | Critical, needs action |
| **Icon:** 🔴 | Red alert |
| **Cause:** Invalid API key | Expired credentials |

**Actions Required:**
1. Check API key is correct
2. Verify account is active
3. Generate new key if needed
4. Update in Aperture settings

### Rate Limit Errors

| Indicator | Meaning |
|-----------|---------|
| **Severity:** Warning | Temporary limitation |
| **Icon:** 🟡 | Yellow alert |
| **Cause:** Too many requests | Quota exceeded |

**Actions:**
1. Wait for rate limit reset
2. Reduce request frequency
3. Upgrade API tier if persistent

### Service Outage Errors

| Indicator | Meaning |
|-----------|---------|
| **Severity:** Info | External issue |
| **Icon:** 🔵 | Blue alert |
| **Cause:** Service unavailable | Server errors (500, 502, etc.) |

**Actions:**
1. Wait for service recovery
2. Check service status page
3. Alert auto-dismisses on recovery

---

## Error Alert Display

### What's Shown

- Service name (TMDb, OMDb, etc.)
- Error type
- Error message
- Timestamp
- Recommended action

### Alert Components

```
┌─────────────────────────────────────────┐
│ 🔴 TMDb Authentication Error            │
│                                         │
│ Invalid API key. Please check your      │
│ configuration.                          │
│                                         │
│ 2025-01-15 14:30:22           [Dismiss] │
└─────────────────────────────────────────┘
```

---

## Auto-Dismiss Behavior

### Service Outage Recovery

When a service recovers:
1. Aperture tests connection
2. If successful, alert auto-clears
3. No manual dismissal needed

### When Auto-Dismiss Occurs

- **Test Connection** clicked and succeeds
- Job completes successfully
- Background health check passes

---

## Manual Dismissal

### Dismissing Alerts

Click **Dismiss** or **X** on the alert.

### When to Dismiss

- Error was investigated
- Issue was resolved
- False positive
- Intentionally disabled integration

### Retention

Dismissed alerts are:
- Removed from UI immediately
- Cleaned from database after 7 days
- Not counted in error totals

---

## Per-Service Errors

### TMDb Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid API key | Update key |
| 429 Rate Limited | Too many requests | Wait, space out jobs |
| 503 Service Unavailable | TMDb down | Wait for recovery |

### OMDb Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Invalid API key | Key not activated | Verify email |
| Request limit reached | Daily limit hit | Wait until midnight UTC |
| Movie not found | No match in OMDb | Normal for some content |

### Trakt Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Invalid credentials | Client ID/Secret wrong | Reconfigure in Aperture |
| Token expired | User auth expired | User re-authenticates |
| Rate limited | Too many requests | Wait 5 minutes |

### MDBList Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid API key | Update key |
| List not found | List deleted or private | Select different list |

### Jellyseerr Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Connection refused | Wrong URL | Check URL and port |
| Unauthorized | Invalid API key | Update key |
| User not found | User mapping issue | Check user configuration |

---

## Error Logging

### Where Errors Are Logged

- Job logs (Admin → Jobs → History)
- System logs (Docker container)
- Database error records

### Log Information

Each error record includes:
- Timestamp
- Service name
- Error code
- Error message
- Request details (sanitized)

---

## Monitoring

### Error Patterns

Watch for:
- Repeated authentication errors
- Frequent rate limits
- Persistent outages

### Alerting

Currently, alerts are:
- Displayed in UI
- Not sent via email/webhook

Future: Email notifications (TBD feature)

---

## Troubleshooting

### Many Errors Suddenly

1. Check service status (may be down)
2. Verify nothing changed (API keys, etc.)
3. Review recent configuration changes

### Errors During Jobs

1. Job may still complete partially
2. Check job logs for specifics
3. Retry affected items

### Persistent Authentication Errors

1. Delete and re-enter API key
2. Verify account status
3. Generate fresh API key
4. Test connection after saving

---

## Error Prevention

### Best Practices

| Practice | Why |
|----------|-----|
| Use dedicated API keys | Track Aperture usage |
| Monitor quotas | Avoid hitting limits |
| Space out jobs | Reduce request bursts |
| Keep keys secure | Prevent revocation |

### Quota Management

| Service | How to Monitor |
|---------|---------------|
| TMDb | Dashboard at themoviedb.org |
| OMDb | Usage shown on omdbapi.com |
| OpenAI | Dashboard at platform.openai.com |

---

**Previous:** [User Permissions](user-permissions.md) | **Next:** [Recommended Workflow](recommended-workflow.md)
