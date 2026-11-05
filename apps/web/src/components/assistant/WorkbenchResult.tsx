import { useEffect,useState } from 'react'
import { Alert,Box,Chip,Paper,Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { EncorePlan,EncoreMemory,EncoreAction,EncoreCollection } from '@aperture/core/encore'
import { PlanCard } from './PlanCard'
import { ActionCard } from './ActionCard'
import { assistantRequest } from './hooks/useConversations'
export function WorkbenchResult({data}:{data:Record<string,unknown>}) {
  const {t}=useTranslation(),[current,setCurrent]=useState(data),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const actionId=(data.action as EncoreAction|undefined)?.id,planId=(data.plan as EncorePlan|undefined)?.id
  useEffect(()=>{
    if(!actionId&&!planId)return
    let live=true
    void assistantRequest<Record<string,unknown>>(`/api/assistant/${actionId?'actions':'plans'}/${actionId??planId}`).then(result=>{if(live)setCurrent(result)}).catch(e=>{if(live)setError(String(e))})
    return()=>{live=false}
  },[actionId,planId])
  async function command(name:string,input:unknown) {
    setBusy(true);setError('')
    try{const result=await assistantRequest<Record<string,unknown>>(`/api/assistant/workbench/${name}`,{method:'POST',body:JSON.stringify(input)});setCurrent(result);return result}
    catch(e){setError(String(e));throw e}finally{setBusy(false)}
  }
  async function approve(id:string) {
    setBusy(true);setError('')
    try{const result=await assistantRequest<Record<string,unknown>>(`/api/assistant/actions/${id}/approve`,{method:'POST',body:JSON.stringify({approved:true})});setCurrent(result)}
    catch(e){setError(String(e));throw e}finally{setBusy(false)}
  }
  const plans=current.plan?[current.plan as EncorePlan]:(current.plans??[]) as EncorePlan[]
  const memories=current.memory?[current.memory as EncoreMemory]:(current.memories??[]) as EncoreMemory[]
  const actions=current.action?[current.action as EncoreAction]:(current.actions??[]) as EncoreAction[]
  return <Box sx={{my:2}}>{error&&<Alert severity="error">{error}</Alert>}
    {plans.map(plan=><PlanCard key={plan.id} plan={plan} busy={busy} command={command}/>)}
    {memories.map(memory=><Paper key={memory.id} variant="outlined" sx={{p:2,borderRadius:3,my:1}}><Chip size="small" label={t(`encore.memoryKinds.${memory.kind}`)}/><Typography sx={{mt:1}}>{memory.fact}</Typography><Typography variant="caption" color="text.secondary">{t('encore.memoryManageHint')}</Typography></Paper>)}
    {actions.map(action=><ActionCard key={action.id} action={action} collection={(current.collection as EncoreCollection|undefined)??(current.collections as EncoreCollection[]|undefined)?.find(c=>c.id===action.collection_id)} busy={busy} command={command} approve={approve}/>)}
    {['memoryForgotten','planDeleted','actionCancelled'].includes(String(current.kind))&&<Alert severity="success">{t('encore.changeSaved')}</Alert>}
    {!plans.length&&!memories.length&&!actions.length&&!['memoryForgotten','planDeleted','actionCancelled'].includes(String(current.kind))&&<Typography variant="body2" color="text.secondary">{t('encore.noSavedItems')}</Typography>}
  </Box>
}
