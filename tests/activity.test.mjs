import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {normalizeHealthPayload,normalizeStravaActivity,aggregateWorkouts,isISODate} from '../activity-core.mjs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../activity.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/20261125_connected_activity.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/known-activity-integrations/index.ts',import.meta.url),'utf8');

test('Apple Health payload accepts only bounded daily exercise, steps and sleep totals',()=>{
  assert.deepEqual(normalizeHealthPayload({day:'2026-11-25',steps:8123,exercise_minutes:46.5,sleep_minutes:452}),{
    day:'2026-11-25',steps:8123,exercise_minutes:46.5,sleep_minutes:452
  });
  assert.throws(()=>normalizeHealthPayload({day:'2026-02-30',steps:10}));
  assert.throws(()=>normalizeHealthPayload({day:'2026-11-25',steps:-1}));
  assert.throws(()=>normalizeHealthPayload({day:'2026-11-25',sleep_minutes:1500}));
  assert.equal(isISODate('2026-11-25'),true);
  assert.equal(isISODate('2026-13-25'),false);
});

test('Strava activity mapping retains detail and local calendar day',()=>{
  const row=normalizeStravaActivity({
    id:12345,name:'Morning ride',sport_type:'Ride',
    start_date:'2026-11-25T14:00:00Z',start_date_local:'2026-11-25T08:00:00',
    moving_time:3660,distance:28000,total_elevation_gain:240
  });
  assert.equal(row.external_id,'12345');
  assert.equal(row.day,'2026-11-25');
  assert.equal(row.sport_type,'Ride');
  assert.equal(row.duration_seconds,3660);
  assert.equal(row.distance_meters,28000);
  assert.equal(row.elevation_gain_meters,240);
});

test('Workout aggregates are day-based and do not mix providers',()=>{
  const rows=aggregateWorkouts([
    {day:'2026-11-25',duration_seconds:1800},
    {day:'2026-11-25',duration_seconds:3600},
    {day:'2026-11-24',duration_seconds:900}
  ]);
  assert.deepEqual(rows,[
    {day:'2026-11-24',workout_count:1,workout_minutes:15},
    {day:'2026-11-25',workout_count:2,workout_minutes:90}
  ]);
});

test('Dashboard exposes activity minutes, workout detail, steps and sleep without double-counting',()=>{
  assert.match(app,/id="activity-summary"/);
  assert.match(app,/id="activity-habit-detail"/);
  assert.match(app,/activityDone:!!activityHabit&&isDone\(activityHabit\)/);
  assert.match(ui,/Prefer Apple Exercise Minutes/);
  assert.match(ui,/No double-counting/);
  assert.match(ui,/sleep/);
  assert.match(ui,/Today's activity/);
  assert.match(ui,/Imported activity never auto-checks a habit/);
  assert.match(html,/src="\/activity.js"/);
  assert.match(sw,/known-daily-v9-connected-activity/);
  assert.match(sw,/\/activity.js/);
});

test('Integration credentials and activity tables remain server-only',()=>{
  for(const table of ['daily_activity_connections','daily_activity_summaries','daily_activity_workouts','daily_activity_credentials','daily_activity_oauth_states']){
    assert.match(migration,new RegExp('create table if not exists public\\.'+table));
    assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security'));
    assert.match(migration,new RegExp('revoke all on table public\\.'+table+' from anon, authenticated'));
  }
  assert.match(edge,/STRAVA_TOKEN_ENCRYPTION_KEY/);
  assert.match(edge,/token_hash/);
  assert.match(edge,/auth\/v1\/user/);
  assert.match(edge,/activity:read_all/);
  assert.match(edge,/apple-health-ingest/);
});
