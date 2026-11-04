import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../formation.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migrations/20261104_formation_practices.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('weekly gratitude uses Sunday-based local week, stable during a week',()=>{
  const window={};
  runInNewContext(source,{window,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000000'}});
  const week=window.KNOWN_FORMATION.startOfWeek;
  assert.equal(week('2026-11-01'),'2026-11-01');
  assert.equal(week('2026-11-04'),'2026-11-01');
  assert.equal(week('2026-11-07'),'2026-11-01');
  assert.equal(week('2026-11-08'),'2026-11-08');
});

test('all six new tables and photo bucket include private RLS policies',()=>{
  const names=['daily_prayer_requests','daily_prayer_updates','daily_prayer_checkins',
    'daily_prayer_sessions','daily_gratitude','daily_notes'];
  for(const name of names){
    assert.ok(sql.includes('create table if not exists public.'+name),name+' exists');
    assert.ok(sql.includes('alter table public.'+name+' enable row level security'),name+' RLS');
    assert.ok(sql.includes('on public.'+name+'\n  for all to authenticated'),name+' own policy');
  }
  assert.match(sql,/daily_prayer_checkins_owner_fk foreign key\(request_id,user_id\)/);
  assert.match(sql,/daily_prayer_updates_owner_fk foreign key\(request_id,user_id\)/);
  assert.ok(sql.includes("values('daily-note-photos','daily-note-photos',false"));
  assert.ok(sql.includes('daily_notes_photos_read'));
});

test('formation app is bundled and photo converter is reused',()=>{
  assert.ok(html.includes('src="/formation.js"'));
  assert.ok(sw.includes("'/formation.js'"));
  assert.ok(app.includes('window.KNOWN_DAILY_PHOTO={compressImage,isPhotoFile}'));
  assert.ok(app.includes('window.KNOWN_FORMATION?.mount'));
  assert.ok(source.includes('Tesseract.recognize'));
  assert.ok(source.includes('data-notes-append'));
  assert.ok(source.includes('answered_at'));
  assert.ok(source.includes('data-prayer-check'));
});
