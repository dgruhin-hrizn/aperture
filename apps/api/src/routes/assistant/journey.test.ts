import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { closePool,getPool,runMigrations } from '@aperture/core'
import { createEncoreContext,createEncoreTools,listEncoreMemories,getEncorePlan,createEncoreConnection,ENCORE_SCOPES,runDueEncoreCurations,type EncoreAction,type EncoreCollection,type EncorePlan,type EncoreCuration } from '@aperture/core/encore'
import { registerWorkbenchHandlers } from './handlers/workbench.js'
const database=process.env.ENCORE_TEST_DATABASE_URL

test('persistent memory, planning and approved Emby actions survive corrections, retries and cross-user attempts',{skip:!database},async(t)=>{
  process.env.DATABASE_URL=database!
  assert.equal((await runMigrations(database!,new URL('../../../../../db/migrations/',import.meta.url).pathname)).error,undefined)
  const pool=getPool(),originalFetch=globalThis.fetch,prefix=randomUUID(),owner=randomUUID(),other=randomUUID(),account=`${prefix}-owner`
  const seriesId=randomUUID(),seriesProvider=`${prefix}-show`,episodeA=randomUUID(),episodeB=randomUUID()
  const movies=[{id:randomUUID(),providerId:`${prefix}-a`,name:'Quiet Signal',minutes:80},{id:randomUUID(),providerId:`${prefix}-b`,name:'Long Journey',minutes:120},{id:randomUUID(),providerId:`${prefix}-c`,name:'Manual Addition',minutes:50}]
  await pool.query("INSERT INTO users(id,provider,provider_user_id,provider_access_token,username,is_enabled) VALUES($1,'emby',$2,'owner-token','Journey',true),($3,'emby',$4,'other-token','Other',true)",[owner,account,other,`${prefix}-other`])
  for(const movie of movies)await pool.query('INSERT INTO movies(id,provider_item_id,title,runtime_minutes) VALUES($1,$2,$3,$4)',[movie.id,movie.providerId,movie.name,movie.minutes])
  await pool.query('INSERT INTO series(id,provider_item_id,title) VALUES($1,$2,$3)',[seriesId,seriesProvider,'An accessible series'])
  await pool.query("INSERT INTO episodes(id,series_id,provider_item_id,season_number,episode_number,title,runtime_minutes) VALUES($1,$2,$3,1,1,'Visible episode',30),($4,$2,$5,1,2,'Restricted episode',30)",[episodeA,seriesId,`${prefix}-episode-a`,episodeB,`${prefix}-episode-b`])
  for(const [key,value] of [['media_server_type','emby'],['media_server_base_url','http://encore-journey.test'],['media_server_api_key','fixture-admin']])await pool.query('INSERT INTO system_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,value])
  const playlists=new Map<string,{name:string;items:Array<{Id:string;PlaylistItemId:string}>}>()
  let createCount=0,loseCreate=false,loseAppend=false,privateCount=0,catalogUnavailable=false,connectionId='journey-fixture'
  let sections:Array<{Id:string;SectionType:string;ParentId?:string;CustomName?:string}>=[{Id:'manual-home',SectionType:'latest'}]
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input instanceof Request?input.url:input)),method=init?.method??'GET'
    if(url.origin!=='http://encore-journey.test')return originalFetch(input,init)
    const path=url.pathname
    if(path==='/System/Info/Public')return Response.json({Id:'journey-server'})
    if(path==='/Users')return Response.json([{Id:account,Name:'Journey',Policy:{IsAdministrator:false,IsDisabled:false}},{Id:`${prefix}-other`,Name:'Other',Policy:{IsAdministrator:false,IsDisabled:false}}])
    if(path.endsWith('/HomeSections/Delete')){const ids=(JSON.parse(String(init?.body)) as {Ids:string[]}).Ids;sections=sections.filter(s=>!ids.includes(s.Id));return new Response(null,{status:204})}
    if(path.endsWith('/HomeSections')){
      if(method==='POST')sections.push({Id:`section-${sections.length}`,...JSON.parse(String(init?.body))});return Response.json(sections)
    }
    if(path==='/Playlists'&&method==='POST'){
      const id=`playlist-${++createCount}`;playlists.set(id,{name:url.searchParams.get('Name')!,items:[]})
      if(loseCreate){loseCreate=false;throw new Error('Fixture connection lost after creation')}
      return Response.json({Id:id})
    }
    if(path.endsWith('/MakePrivate')){privateCount++;return new Response(null,{status:200})}
    const match=path.match(/^\/Playlists\/([^/]+)\/Items$/)
    if(match){
      const playlist=playlists.get(match[1])!;assert.ok(playlist)
      if(method==='POST'){
        for(const id of url.searchParams.get('Ids')!.split(','))playlist.items.push({Id:id,PlaylistItemId:randomUUID()})
        if(loseAppend){loseAppend=false;throw new Error('Fixture connection lost after append')}
      }
      if(method==='DELETE'){const ids=url.searchParams.get('EntryIds')!.split(',');playlist.items=playlist.items.filter(i=>!ids.includes(i.PlaylistItemId))}
      return method==='GET'?Response.json({Items:playlist.items,TotalRecordCount:playlist.items.length}):new Response(null,{status:204})
    }
    if(path==='/Items'||path.endsWith('/Items')){
      if(catalogUnavailable)return new Response(null,{status:503})
      const isOwner=path.includes(account)||url.searchParams.get('UserId')===account
      if(!isOwner)return Response.json({Items:[],TotalRecordCount:0})
      const ids=url.searchParams.get('Ids')?.split(','),type=url.searchParams.get('IncludeItemTypes')
      const items=type==='Playlist'?[...playlists].filter(([id])=>!ids||ids.includes(id)).map(([id,p])=>({Id:id,Name:p.name,Type:'Playlist',CanManageAccess:true})):[...movies.map(m=>({Id:m.providerId,Name:m.name,Type:'Movie',RunTimeTicks:m.minutes*600_000_000,UserData:{Played:false}})),{Id:seriesProvider,Name:'An accessible series',Type:'Series'},{Id:`${prefix}-episode-a`,Name:'Visible episode',Type:'Episode',RunTimeTicks:30*600_000_000,UserData:{Played:false}}].filter(item=>(!ids||ids.includes(item.Id))&&(!type||type.split(',').includes(item.Type)))
      return Response.json({Items:items,TotalRecordCount:items.length})
    }
    throw new Error(`Unexpected fixture request ${method} ${path}`)
  }
  async function call<T=Record<string,unknown>>(name:string,args:unknown,userId=owner){
    const tools=createEncoreTools({...await createEncoreContext(userId),source:'mcp',sourceId:connectionId})
    assert.ok(tools[name],name)
    return await tools[name].execute!(args as never,{toolCallId:randomUUID(),messages:[],context:undefined}) as T
  }
  const selection=(index:number)=>({id:movies[index].id,type:'movie' as const})
  const app=Fastify();app.addHook('onRequest',async request=>{request.user={id:owner,username:'Journey',displayName:null,provider:'emby',providerUserId:account,isAdmin:false,isEnabled:true,canManageWatchHistory:false,avatarUrl:null}});registerWorkbenchHandlers(app)
  try{
    const invalidWorkbench = await app.inject({ method: 'POST', url: '/api/assistant/workbench/deleteWatchPlan', payload: { id: 'not-a-uuid' } })
    assert.equal(invalidWorkbench.statusCode,400)
    assert.equal(invalidWorkbench.json().error,'Invalid tool arguments')
    const episodeResult=await call<{episodes:Array<{id:string;title:string}>}>('getNextEpisodes',{seriesId})
    assert.deepEqual(episodeResult.episodes.map(episode=>episode.id),[episodeA])
    assert.doesNotMatch(JSON.stringify(episodeResult),/Restricted episode/)
    const memory=await call<{memory:{id:string}}>('rememberPreference',{key:'spoilers',kind:'spoiler',fact:'Avoid future episode spoilers'})
    assert.equal((await listEncoreMemories(owner)).memories.length,1)
    await assert.rejects(call('forgetMemory',{id:memory.memory.id},other),/not found/)
    await call('rememberPreference',{key:'spoilers',kind:'spoiler',fact:'Discuss spoilers only after I finish a season'})
    assert.equal((await listEncoreMemories(owner)).memories[0].id,memory.memory.id)
    await call('rememberPreference',{key:'quiet-sf',kind:'preference',fact:'I enjoy quiet science fiction'})
    assert.equal((await pool.query('SELECT count(*) FROM user_custom_interests WHERE user_id=$1',[owner])).rows[0].count,'1')
    await call('rememberPreference',{key:'quiet-sf',kind:'preference',fact:'I prefer thoughtful science fiction'})
    assert.equal((await pool.query('SELECT count(*) FROM user_custom_interests WHERE user_id=$1',[owner])).rows[0].count,'1')
    const preference=(await listEncoreMemories(owner)).memories.find(m=>m.fact_key==='quiet-sf')!
    await call('forgetMemory',{id:preference.id})
    assert.equal((await pool.query('SELECT count(*) FROM user_custom_interests WHERE user_id=$1',[owner])).rows[0].count,'0')
    const draft=await call<{plan:EncorePlan}>('createWatchPlan',{name:'Friday night',timezone:'America/New_York',windows:[{start:'2030-11-08T20:00',minutes:90}],items:[selection(0),selection(1)]})
    assert.equal(draft.plan.schedule.slots.length,1);assert.equal(draft.plan.schedule.unplaced[0].reason,'doesNotFit')
    await assert.rejects(getEncorePlan(other,draft.plan.id),/not found/)
    const saved=await call<{plan:EncorePlan}>('updateWatchPlan',{id:draft.plan.id,revision:1,operation:'save'})
    assert.equal(saved.plan.status,'saved')
    await assert.rejects(call('updateWatchPlan',{id:draft.plan.id,revision:1,operation:'save'}),/changed/)
    const calendar=await app.inject({url:`/api/assistant/plans/${draft.plan.id}/calendar.ics`})
    assert.equal(calendar.statusCode,200);assert.match(calendar.body,/DTSTART:20301109T010000Z/)
    const proposed=await call<{action:EncoreAction;collection:EncoreCollection}>('proposePlaylist',{operation:'create',name:'Quiet shelf',items:[selection(0)]})
    const repeated=await call<{action:EncoreAction}>('proposePlaylist',{operation:'create',name:'Quiet shelf',items:[selection(0)]})
    assert.equal(repeated.action.id,proposed.action.id);assert.equal(createCount,0)
    assert.equal(createEncoreTools({...await createEncoreContext(owner),source:'encore'}).executeEncoreAction,undefined)
    await assert.rejects(call('executeEncoreAction',{id:proposed.action.id,approved:true},other),/not found/)
    const done=await call<{action:EncoreAction;collection:EncoreCollection}>('executeEncoreAction',{id:proposed.action.id,approved:true})
    assert.equal(done.action.status,'succeeded');assert.equal(createCount,1);assert.ok(privateCount)
    await call('executeEncoreAction',{id:proposed.action.id,approved:true});assert.equal(createCount,1)
    const playlist=playlists.get(done.collection.provider_playlist_id!)!
    playlist.items.push({Id:movies[2].providerId,PlaylistItemId:randomUUID()})
    const update=await call<{action:EncoreAction}>('proposePlaylist',{operation:'update',collectionId:done.collection.id,items:[selection(1)]})
    const privacyBeforeUpdate=privateCount
    loseAppend=true
    await assert.rejects(call('executeEncoreAction',{id:update.action.id,approved:true}),/lost after append/)
    await call('executeEncoreAction',{id:update.action.id,approved:true})
    assert.deepEqual(playlist.items.map(i=>i.Id),[movies[2].providerId,movies[1].providerId])
    assert.equal(privateCount,privacyBeforeUpdate,'ordinary updates preserve user-managed sharing settings')
    const retryState=(await pool.query('SELECT baseline,manual_exclusions FROM encore_collections WHERE id=$1',[done.collection.id])).rows[0]
    assert.deepEqual(retryState.baseline,[movies[1].providerId]);assert.deepEqual(retryState.manual_exclusions,[])
    const pin=await call<{action:EncoreAction}>('proposeHomeRow',{operation:'pin',collectionId:done.collection.id})
    await call('executeEncoreAction',{id:pin.action.id,approved:true});assert.equal(sections.length,2);assert.equal(sections[0].Id,'manual-home')
    const unpin=await call<{action:EncoreAction}>('proposeHomeRow',{operation:'unpin',collectionId:done.collection.id})
    await call('executeEncoreAction',{id:unpin.action.id,approved:true});assert.deepEqual(sections,[{Id:'manual-home',SectionType:'latest'}])
    const unknown=await call<{action:EncoreAction}>('proposePlaylist',{operation:'create',name:'Recovered shelf',items:[selection(0)]})
    loseCreate=true
    await assert.rejects(call('executeEncoreAction',{id:unknown.action.id,approved:true}),/lost after creation/)
    await assert.rejects(call('executeEncoreAction',{id:unknown.action.id,approved:true}),/unknown outcome/)
    assert.equal(createCount,2)
    await call('reconcilePlaylist',{id:unknown.action.id,playlistUrl:'http://emby.test/web/index.html#!/item?id=playlist-2'})
    await call('executeEncoreAction',{id:unknown.action.id,approved:true});assert.equal(createCount,2)
    // Opt-in recurring work uses exactly the same approved collection service.
    connectionId=(await createEncoreConnection(owner,'Recurring fixture',[...ENCORE_SCOPES],1)).connection.id
    const prepared=await call<{curation:EncoreCuration}>('prepareCuration',{name:'Friday discoveries',collectionId:done.collection.id,recipe:{mediaType:'movies',maxRuntime:90,limit:10},schedule:{cadence:'weekly',day:5,time:'17:00',timezone:'America/New_York'}})
    const curationId=prepared.curation.id
    assert.equal(prepared.curation.enabled,false)
    assert.deepEqual(await runDueEncoreCurations({id:curationId,limit:1}),[])
    assert.equal(createEncoreTools(await createEncoreContext(owner),['curation:write']).prepareCuration,undefined)
    await call('controlCuration',{id:curationId,operation:'enable',approved:true})
    await pool.query("UPDATE encore_curations SET next_run_at=now()-interval '1 minute' WHERE id=$1",[curationId])
    const concurrent=await Promise.all([runDueEncoreCurations({id:curationId,limit:1}),runDueEncoreCurations({id:curationId,limit:1})])
    assert.equal(concurrent.flat().length,1);assert.equal(concurrent.flat()[0].status,'succeeded',JSON.stringify(concurrent))
    assert.ok(playlist.items.some(item=>item.Id===movies[2].providerId),'manual addition survives recurring refresh')
    assert.ok(playlist.items.some(item=>item.Id===movies[0].providerId),'an interrupted automated removal does not become a manual exclusion')
    let record=(await pool.query('SELECT * FROM encore_curations WHERE id=$1',[curationId])).rows[0]
    assert.ok(record.next_run_at);assert.equal(record.enabled,true)
    const firstRun=(await pool.query('SELECT * FROM encore_curation_runs WHERE curation_id=$1 ORDER BY started_at DESC LIMIT 1',[curationId])).rows[0]
    const beforeRecovery=JSON.stringify(playlist.items)
    await pool.query("UPDATE encore_curations SET next_run_at=$2,lease_id=$3,lease_expires_at=now()-interval '1 minute' WHERE id=$1",[curationId,firstRun.scheduled_for,randomUUID()])
    const recovered=await runDueEncoreCurations({id:curationId,limit:1})
    assert.equal(recovered[0].status,'succeeded');assert.equal(JSON.stringify(playlist.items),beforeRecovery)
    const recoveredRun=(await pool.query('SELECT * FROM encore_curation_runs WHERE id=$1',[firstRun.id])).rows[0]
    assert.equal(recoveredRun.result.recovered,true);assert.equal(recoveredRun.attempts,2);assert.ok(recoveredRun.result.selected[0].id)
    // Manual removals stay excluded across recipe changes and future refreshes.
    playlist.items=playlist.items.filter(item=>item.Id!==movies[0].providerId)
    // Run now must be immediately claimable even when the application clock is ahead of PostgreSQL.
    t.mock.timers.enable({apis:['Date'],now:Date.now()+60_000})
    try { await call('controlCuration',{id:curationId,operation:'run',approved:true}) }
    finally { t.mock.timers.reset() }
    assert.ok(!playlist.items.some(item=>item.Id===movies[0].providerId))
    const collectionRecord=(await pool.query('SELECT baseline,manual_exclusions FROM encore_collections WHERE id=$1',[done.collection.id])).rows[0]
    assert.ok(!collectionRecord.baseline.includes(movies[2].providerId),'automatic selection does not adopt a manual addition')
    assert.ok(collectionRecord.manual_exclusions.includes(movies[0].providerId))
    const beforeRevocation=JSON.stringify(playlist.items)
    await pool.query('UPDATE encore_mcp_connections SET revoked_at=now() WHERE id=$1',[connectionId])
    await pool.query("UPDATE encore_curations SET next_run_at=now()-interval '1 minute' WHERE id=$1",[curationId])
    const deniedRun=await runDueEncoreCurations({id:curationId,limit:1})
    assert.equal(deniedRun[0].status,'failed');assert.match(deniedRun[0].error!,/revoked/)
    assert.equal(JSON.stringify(playlist.items),beforeRevocation)
    record=(await pool.query('SELECT * FROM encore_curations WHERE id=$1',[curationId])).rows[0]
    assert.equal(record.enabled,false)
    const reauthorized=await app.inject({method:'POST',url:`/api/assistant/curations/${curationId}/control`,payload:{operation:'enable',approved:true}})
    assert.equal(reauthorized.statusCode,200)
    record=(await pool.query('SELECT * FROM encore_curations WHERE id=$1',[curationId])).rows[0]
    const editRule=async(maxRuntime:number)=>{
      record=(await pool.query('SELECT * FROM encore_curations WHERE id=$1',[curationId])).rows[0]
      const edited=await app.inject({method:'POST',url:'/api/assistant/workbench/updateCuration',payload:{id:curationId,revision:record.revision,input:{name:record.name,collectionId:record.collection_id,recipe:{...record.recipe,maxRuntime},schedule:record.schedule}}})
      assert.equal(edited.statusCode,200,edited.body);assert.equal(edited.json().curation.enabled,false)
      await app.inject({method:'POST',url:`/api/assistant/curations/${curationId}/control`,payload:{operation:'enable',approved:true}})
      const ran=await app.inject({method:'POST',url:`/api/assistant/curations/${curationId}/control`,payload:{operation:'run',approved:true}})
      assert.equal(ran.statusCode,200,ran.body)
    }
    await editRule(60);await editRule(90)
    assert.ok(!playlist.items.some(item=>item.Id===movies[0].providerId),'a later recipe does not resurrect a manual removal')
    assert.ok(playlist.items.some(item=>item.Id===movies[2].providerId),'a manual addition remains private to user control')
    catalogUnavailable=true
    await pool.query("UPDATE encore_curations SET next_run_at=now()-interval '1 minute' WHERE id=$1",[curationId])
    const failure=await runDueEncoreCurations({id:curationId,limit:1})
    assert.equal(failure[0].status,'failed');assert.match(failure[0].error!,/503/);assert.equal(JSON.stringify(playlist.items),beforeRevocation)
    catalogUnavailable=false
    await assert.rejects(call('pauseCuration',{id:curationId},other),/not found/)
    const state=await app.inject({url:'/api/assistant/workbench'});assert.equal(state.statusCode,200);assert.match(state.body,/Quiet shelf/)
    await call('forgetMemory',{id:memory.memory.id});assert.equal((await listEncoreMemories(owner)).memories.length,0)
  }finally{
    globalThis.fetch=originalFetch;await app.close();await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,other]]);await pool.query('DELETE FROM movies WHERE id=ANY($1::uuid[])',[movies.map(m=>m.id)]);await pool.query('DELETE FROM series WHERE id=$1',[seriesId]);await closePool()
  }
})
