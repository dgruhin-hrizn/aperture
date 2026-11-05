import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { packViewingWindows,watchPlanCalendar,reconcileEncoreMembership,planInput,nextEncoreCurationRun } from '@aperture/core/encore'

test('watch windows enforce hard runtime, episode order, DST ambiguity and calendar escaping',()=>{
  const a=randomUUID(),b=randomUUID(),c=randomUUID()
  const input=planInput.parse({name:'Friday, films',timezone:'America/New_York',windows:[{start:'2030-11-08T20:00',minutes:90}],items:[{id:a,type:'movie'},{id:b,type:'movie'},{id:c,type:'movie'}]})
  const schedule=packViewingWindows(input,[{id:a,type:'movie',title:'Quiet; Signal',minutes:80,providerId:'a'},{id:b,type:'movie',title:'Too long',minutes:120,providerId:'b'},{id:c,type:'movie',title:'Unknown',minutes:null,providerId:'c'}])
  assert.equal(schedule.slots.length,1);assert.equal(schedule.slots[0].start,'2030-11-09T01:00:00Z')
  assert.deepEqual(schedule.unplaced.map(i=>i.reason),['doesNotFit','unknownRuntime'])
  assert.throws(()=>packViewingWindows({...input,windows:[{start:'2026-11-01T01:30',minutes:90}]},[]),/multiple instants|ambiguous/i)
  assert.throws(()=>packViewingWindows({...input,windows:[{start:'2026-03-08T02:30',minutes:90}]},[]))
  assert.throws(()=>packViewingWindows({...input,windows:[...input.windows,...input.windows]},[]),/overlap/)
  const episodes=packViewingWindows(input,[{id:b,type:'episode',title:'Episode 2',minutes:30,providerId:'b',seriesId:'s',order:2},{id:a,type:'episode',title:'Episode 1',minutes:120,providerId:'a',seriesId:'s',order:1}])
  assert.equal(episodes.slots.length,0)
  const ics=watchPlanCalendar('plan',input.name,schedule.slots)
  assert.match(ics,/DTSTART:20301109T010000Z/);assert.match(ics,/SUMMARY:Quiet\\; Signal/);assert.match(ics,/DESCRIPTION:Friday\\, films/)
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
})
test('collection reconciliation preserves manual additions and removals',()=>{
  const diff=reconcileEncoreMembership(['managed-old','manual'],['managed-old','user-removed'],['user-removed','managed-new'])
  assert.deepEqual(diff.remove,['managed-old']);assert.deepEqual(diff.add,['managed-new']);assert.deepEqual(diff.target,['manual','managed-new'])
})

test('recurring wall-clock schedules resolve spring gaps and first fall occurrence consistently',()=>{
  assert.equal(nextEncoreCurationRun({cadence:'weekly',day:7,time:'02:30',timezone:'America/New_York'},new Date('2026-03-07T12:00:00Z')),'2026-03-08T07:30:00Z')
  assert.equal(nextEncoreCurationRun({cadence:'weekly',day:7,time:'01:30',timezone:'America/New_York'},new Date('2026-10-31T12:00:00Z')),'2026-11-01T05:30:00Z')
  const diff=reconcileEncoreMembership(['manual'],[],['formerly-removed'],['formerly-removed'])
  assert.deepEqual(diff.add,[]);assert.deepEqual(diff.manualRemovals,['formerly-removed'])
})

test('interrupted managed changes do not become manual edits on retry',()=>{
 const diff=reconcileEncoreMembership(['manual','new'],['old'],['new'],[],{add:['new'],remove:['old'],manualAdditions:['manual'],manualRemovals:[]})
 assert.deepEqual(diff.manualAdditions,['manual']);assert.deepEqual(diff.manualRemovals,[]);assert.deepEqual(diff.add,[]);assert.deepEqual(diff.remove,[])
})
