import { CurationCard } from './CurationCard'
import { useEffect, useState } from 'react'
import { Alert, Box, Chip, Paper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type {
  EncorePlan,
  EncoreMemory,
  EncoreAction,
  EncoreCollection,
  EncoreCuration,
  CurationRun,
} from '@aperture/core/encore'
import { PlanCard } from './PlanCard'
import { ActionCard } from './ActionCard'
import { assistantRequest } from './hooks/useConversations'
export function WorkbenchResult({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation(),
    [current, setCurrent] = useState(data),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const actionId = (data.action as EncoreAction | undefined)?.id,
    planId = (data.plan as EncorePlan | undefined)?.id,
    curationView = ['curation', 'curations'].includes(String(data.kind))
  useEffect(() => {
    if (!actionId && !planId && !curationView) return
    let live = true
    void assistantRequest<Record<string, unknown>>(
      curationView
        ? '/api/assistant/curations'
        : `/api/assistant/${actionId ? 'actions' : 'plans'}/${actionId ?? planId}`
    )
      .then((result) => {
        if (live) setCurrent(result)
      })
      .catch((e) => {
        if (live) setError(String(e))
      })
    return () => {
      live = false
    }
  }, [actionId, planId, curationView])
  async function command(name: string, input: unknown) {
    setBusy(true)
    setError('')
    try {
      const result = await assistantRequest<Record<string, unknown>>(
        `/api/assistant/workbench/${name}`,
        { method: 'POST', body: JSON.stringify(input) }
      )
      setCurrent(result)
      return result
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setBusy(false)
    }
  }
  async function approve(id: string) {
    setBusy(true)
    setError('')
    try {
      const result = await assistantRequest<Record<string, unknown>>(
        `/api/assistant/actions/${id}/approve`,
        { method: 'POST', body: JSON.stringify({ approved: true }) }
      )
      setCurrent(result)
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setBusy(false)
    }
  }
  async function controlCuration(id: string, operation: 'enable' | 'pause' | 'run' | 'delete') {
    setBusy(true)
    setError('')
    try {
      setCurrent(
        await assistantRequest<Record<string, unknown>>(`/api/assistant/curations/${id}/control`, {
          method: 'POST',
          body: JSON.stringify({ operation, approved: true }),
        })
      )
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setBusy(false)
    }
  }
  const curations = current.curation
    ? [current.curation as EncoreCuration]
    : ((current.curations ?? []) as EncoreCuration[])
  const plans = current.plan
    ? [current.plan as EncorePlan]
    : ((current.plans ?? []) as EncorePlan[])
  const memories = current.memory
    ? [current.memory as EncoreMemory]
    : ((current.memories ?? []) as EncoreMemory[])
  const actions = current.action
    ? [current.action as EncoreAction]
    : ((current.actions ?? []) as EncoreAction[])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, '&& > *': { my: 0 } }}>
      {error && <Alert severity="error">{error}</Alert>}
      {curations.map((curation) => (
        <CurationCard
          key={curation.id}
          curation={curation}
          runs={current.runs as CurationRun[] | undefined}
          busy={busy}
          onControl={controlCuration}
        />
      ))}
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} busy={busy} command={command} />
      ))}
      {memories.map((memory) => (
        <Paper key={memory.id} variant="outlined" sx={{ p: 2, borderRadius: 3, my: 1 }}>
          <Chip size="small" label={t(`encore.memoryKinds.${memory.kind}`)} />
          <Typography sx={{ mt: 1 }}>{memory.fact}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('encore.memoryManageHint')}
          </Typography>
        </Paper>
      ))}
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          collection={
            (current.collection as EncoreCollection | undefined) ??
            (current.collections as EncoreCollection[] | undefined)?.find(
              (c) => c.id === action.collection_id
            )
          }
          busy={busy}
          command={command}
          approve={approve}
        />
      ))}
      {['memoryForgotten', 'planDeleted', 'actionCancelled', 'curationDeleted'].includes(
        String(current.kind)
      ) && <Alert severity="success">{t('encore.changeSaved')}</Alert>}
      {!curations.length &&
        !plans.length &&
        !memories.length &&
        !actions.length &&
        !['memoryForgotten', 'planDeleted', 'actionCancelled', 'curationDeleted'].includes(
          String(current.kind)
        ) && (
          <Typography variant="body2" color="text.secondary">
            {t('encore.noSavedItems')}
          </Typography>
        )}
    </Box>
  )
}
