import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase-setup.sql',import.meta.url),'utf8');
const proxy=readFileSync(new URL('../api/bible.mjs',import.meta.url),'utf8');

test('account pathways remain separate and guest mode remains available',()=>{
  assert.match(app,/auth\.signUp\(\{email,password/);
  assert.match(app,/auth\.signInWithPassword\(\{email,password\}\)/);
  assert.match(app,/auth\.resetPasswordForEmail\(email/);
  assert.match(app,/auth\.updateUser\(\{password\}\)/);
  assert.match(app,/Already have an account\?/);
  assert.match(app,/Guest demo/);
});
test('writing saves are serialized and a local recovery draft exists',()=>{
  assert.match(app,/const writingSaves=new Map\(\)/);
  assert.match(app,/preceding\.catch\(\(\)=>\{\}\)\.then/);
  assert.match(app,/known-daily-unsynced:/);
  assert.match(app,/Not saved — draft retained/);
});
test('completion writes roll back on failed database operations',()=>{
  assert.match(app,/completionSaves\.add\(key\)/);
  assert.match(app,/\.concat\(before\)/);
  assert.match(app,/completionSaves\.delete\(key\)/);
});
test('six personal tables are protected by row-level security',()=>{
  for(const name of ['daily_profiles','daily_habits','daily_completions','daily_writing','daily_readings','daily_photos']){
    assert.ok(sql.includes('alter table public.'+name+' enable row level security'),name);
  }
  assert.match(sql,/daily_completions_habit_owner_fk/);
  assert.match(sql,/values \('daily-photos','daily-photos',false/);
});
test('Bible proxy authenticates before requesting publisher content',()=>{
  assert.match(proxy,/auth\/v1\/user/);
  assert.match(proxy,/process\.env\.API_BIBLE_KEY/);
  assert.match(proxy,/Sign in to KNOWN Daily first/);
  assert.doesNotMatch(proxy,/KtkAqYCg5VoXaz9MxWwR4/);
});
