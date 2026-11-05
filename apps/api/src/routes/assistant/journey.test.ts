import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { closePool,getPool,runMigrations } from '@aperture/core'
import { createEncoreContext,createEncoreTools,listEncoreMemories,getEncorePlan,type EncoreAction,type EncoreCollection,type EncorePlan } from '@aperture/core/encore'
import { registerWorkbenchHandlers } from './handlers/workbench.js'
const database=process.env.ENCORE_TEST_DATABASE_URL

test('persistent memory, planning and approved Emby actions survive corrections, retries and cross-user attempts',{skip:!database},async()=>{
  process.env.DATABASE_URL=database!
  assert.equal((await runMigrations(database!,new URL('../../../../../db/migrations/',import.meta.url).pathname)).error,undefined)
  const pool=getPool(),originalFetch=globalThis.fetch,prefix=randomUUID(),owner=randomUUID(),other=randomUUID(),account=`${prefix}-owner`
  const movies=[{id:randomUUID(),providerId:`${prefix}-a`,name:'Quiet Signal',minutes:80},{id:randomUUID(),providerId:`${prefix}-b`,name:'Long Journey',minutes:120},{id:randomUUID(),providerId:`${prefix}-c`,name:'Manual Addition',minutes:50}]
  await pool.query("INSERT INTO users(id,provider,provider_user_id,provider_access_token,username,is_enabled) VALUES($1,'emby',$2,'owner-token','Journey',true),($3,'emby',$4,'other-token','Other',true)",[owner,account,other,`${prefix}-other`])
  for(const movie of movies)await pool.query('INSERT INTO movies(id,provider_item_id,title,runtime_minutes) VALUES($1,$2,$3,$4)',[movie.id,movie.providerId,movie.name,movie.minutes])
  for(const [key,value] of [['media_server_type','emby'],['media_server_base_url','http://encore-journey.test'],['media_server_api_key','fixture-admin']])await pool.query('INSERT INTO system_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,value])
  const playlists=new Map<string,{name:string;items:Array<{Id:string;PlaylistItemId:string}>}>()
  let createCount=0,loseCreate=false,loseAppend=false,privateCount=0
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
      const isOwner=path.includes(account)||url.searchParams.get('UserId')===account
      if(!isOwner)return Response.json({Items:[],TotalRecordCount:0})
      const ids=url.searchParams.get('Ids')?.split(','),type=url.searchParams.get('IncludeItemTypes')
      const items=type==='Playlist'?[...playlists].filter(([id])=>!ids||ids.includes(id)).map(([id,p])=>({Id:id,Name:p.name,Type:'Playlist',CanManageAccess:true})):movies.filter(m=>!ids||ids.includes(m.providerId)).map(m=>({Id:m.providerId,Name:m.name,Type:'Movie',RunTimeTicks:m.minutes*600_000_000,UserData:{Played:false}}))
      return Response.json({Items:items,TotalRecordCount:items.length})
    }
    throw new Error(`Unexpected fixture request ${method} ${path}`)
  }
  async function call<T=Record<string,unknown>>(name:string,args:unknown,userId=owner){
    const tools=createEncoreTools({...await createEncoreContext(userId),source:'mcp',sourceId:'journey-fixture'})
    assert.ok(tools[name],name)
    return await tools[name].execute!(args as never,{toolCallId:randomUUID(),messages:[],context:undefined}) as T
  }
  const selection=(index:number)=>({id:movies[index].id,type:'movie' as const})
  const app=Fastify();app.addHook('onRequest',async request=>{request.user={id:owner,username:'Journey',displayName:null,provider:'emby',providerUserId:account,isAdmin:false,isEnabled:true,canManageWatchHistory:false,avatarUrl:null}});registerWorkbenchHandlers(app)
  try{
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
    loseAppend=true
    await assert.rejects(call('executeEncoreAction',{id:update.action.id,approved:true}),/lost after append/)
    await call('executeEncoreAction',{id:update.action.id,approved:true})
    assert.deepEqual(playlist.items.map(i=>i.Id),[movies[2].providerId,movies[1].providerId])
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
    const state=await app.inject({url:'/api/assistant/workbench'});assert.equal(state.statusCode,200);assert.match(state.body,/Quiet shelf/)
    await call('forgetMemory',{id:memory.memory.id});assert.equal((await listEncoreMemories(owner)).memories.length,0)
  }finally{
    globalThis.fetch=originalFetch;await app.close();await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,other]]);await pool.query('DELETE FROM movies WHERE id=ANY($1::uuid[])',[movies.map(m=>m.id)]);await closePool()
  }
})
