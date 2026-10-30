/* KNOWN Daily — static PWA, local demo + optional private Supabase sync. */
(() => {
  'use strict';
  const root = document.getElementById('app');
  const C = window.KNOWN_DAILY_CONFIG || {};
  const configured = !!(C.url && C.publishableKey && window.supabase);
  const BOOKS = [
    ['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],['Joshua',24],['Judges',21],['Ruth',4],['1 Samuel',31],['2 Samuel',24],['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],['Nehemiah',13],['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],['Lamentations',5],['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],['Amos',9],['Obadiah',1],['Jonah',4],['Micah',7],['Nahum',3],['Habakkuk',3],['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],['Matthew',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],['Ephesians',6],['Philippians',4],['Colossians',4],['1 Thessalonians',5],['2 Thessalonians',3],['1 Timothy',6],['2 Timothy',4],['Titus',3],['Philemon',1],['Hebrews',13],['James',5],['1 Peter',5],['2 Peter',3],['1 John',5],['2 John',1],['3 John',1],['Jude',1],['Revelation',22]
  ];
  const BOOK_IDS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
  const CHAPTERS = BOOKS.flatMap(([name,n]) => Array.from({length:n}, (_,i) => `${name} ${i+1}`));
  const icons = {time:'☀',reading:'✦',writing:'✎',activity:'↗',check:'✓',bed:'☾'};
  const todayString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateFrom = s => new Date(`${s}T12:00:00`);
  const plusDays = (s,n) => { const d=dateFrom(s); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const longDate = (s, opts) => new Intl.DateTimeFormat('en-US',opts||{weekday:'long',month:'long',day:'numeric'}).format(dateFrom(s));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
  const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const countWords = s => (s.trim().match(/\S+/gu) || []).length;
  const goalText = h => h.kind==='writing' ? `${h.goal} words` : h.kind==='reading' ? `${h.goal} chapters` : h.kind==='activity' ? `${h.goal} minutes` : (h.kind==='time'||h.kind==='bed') ? `Goal ${formatTime(h.targetTime)}` : 'Daily practice';
  const goalText = h => h.kind==='writing' ? `${h.goal} words` : h.kind==='reading' ? (readingPlan()==='year'?'3–4 chapters · yearly plan':`${readingChapterGoal()} chapters · ${PLAN_NAMES[readingPlan()]}`) : h.kind==='activity' ? `${h.goal} minutes` : (h.kind==='time'||h.kind==='bed') ? `Goal ${formatTime(h.targetTime)}` : 'Daily practice';
  const formatTime = t => {if(!t)return '';const [h,m]=t.split(':').map(Number);return new Date(2000,1,1,h,m).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});};
  const defaultHabits = () => [
    {id:uid(), title:'Wake up',kind:'time',goal:1,targetTime:'06:30',position:0},
    {id:uid(), title:'Read the Bible',kind:'reading',goal:3,targetTime:'',position:1},
    {id:uid(), title:'Write',kind:'writing',goal:500,targetTime:'',position:2},
    {id:uid(), title:'Be active',kind:'activity',goal:30,targetTime:'',position:3},
    {id:uid(), title:'Bedtime',kind:'bed',goal:1,targetTime:'22:30',position:4}
  ];
  const newState = () => ({habits:defaultHabits(),completions:[],writing:{},readings:{},photos:{},readingIndex:0,settings:{}});
  let versions=[], versionsStatus='idle', bibleContent=null, bibleRequested='', bibleError='';
  let state, client, user=null, view='today', activeDay=todayString(), editHabit=null, draftTimer=null, activityDraft='30', busy=false, photoUrls=[];
  const STORAGE_KEY='known-daily-demo-v1';
  function localLoad() { try { const s=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(s && Array.isArray(s.habits))return {...newState(),...s}; } catch {} return newState(); }
  function localSave(){ if (!user) { try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));} catch(e){toast('Device storage is full. Export your data.',true);} } }
  const cloud = () => !!(client && user);
  function toast(message,error=false) {const old=document.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;if(error)el.style.background='#914d48';document.body.appendChild(el);setTimeout(()=>el.remove(),3500);}
  function noteError(e){console.error(e);toast(e.message||'A change could not be saved.',true);}
  async function required(request){const {data,error}=await request;if(error)throw error;return data;}
  async function loadCloud(){
    if(!cloud())return;
    let profile = await required(client.from('daily_profiles').select('*').eq('user_id',user.id).maybeSingle());
    if(!profile){
      await required(client.from('daily_profiles').insert({user_id:user.id,reading_index:0,settings:{}}));
      await required(client.from('daily_habits').insert(defaultHabits().map(h=>({...toHabitRow(h),user_id:user.id}))));
      profile={reading_index:0,settings:{}};
    }
    const [habits,logs,writing,readings,photos] = await Promise.all([
      required(client.from('daily_habits').select('*').eq('user_id',user.id).order('position')),
      required(client.from('daily_completions').select('*').eq('user_id',user.id)),
      required(client.from('daily_writing').select('*').eq('user_id',user.id)),
      required(client.from('daily_readings').select('*').eq('user_id',user.id)),
      required(client.from('daily_photos').select('*').eq('user_id',user.id))
    ]);
    state={
      habits:habits.map(h=>({id:h.id,title:h.title,kind:h.kind,goal:h.goal,targetTime:h.target_time||'',position:h.position})),
      completions:logs.map(l=>({habit_id:l.habit_id,day:l.day,details:l.details||{}})),
      writing:Object.fromEntries(writing.map(w=>[w.day,w.content])),
      readings:Object.fromEntries(readings.map(r=>[r.day,r.chapters||[]])),
      photos:Object.fromEntries(photos.map(p=>[p.day,p.path])),
      readingIndex:profile.reading_index||0,settings:profile.settings||{}
    };
    render();
  }
  function toHabitRow(h) {return {id:h.id,title:h.title,kind:h.kind,goal:h.goal||1,target_time:h.targetTime||null,position:h.position||0};}
  async function persistHabit(h){if(cloud())await required(client.from('daily_habits').upsert({...toHabitRow(h),user_id:user.id}));else localSave();}
  async function removeHabit(id){if(cloud())await required(client.from('daily_habits').delete().eq('id',id).eq('user_id',user.id));else localSave();}
  const isDone = (h,day=activeDay) => state.completions.some(c=>c.habit_id===h.id&&c.day===day);
  const dayDone = (day=activeDay) => state.habits.filter(h=>isDone(h,day)).length;
  function pct(day=activeDay){return state.habits.length ? Math.round(100*dayDone(day)/state.habits.length) : 0;}
  async function markComplete(h,done,details={}) {
    state.completions=state.completions.filter(c=>!(c.habit_id===h.id&&c.day===activeDay));
    if(done)state.completions.push({habit_id:h.id,day:activeDay,details});
    render();
    try {if(cloud()) {
      if(done)await required(client.from('daily_completions').upsert({user_id:user.id,habit_id:h.id,day:activeDay,details},{onConflict:'user_id,habit_id,day'}));
      else await required(client.from('daily_completions').delete().eq('user_id',user.id).eq('habit_id',h.id).eq('day',activeDay));
    } else localSave();} catch(e){noteError(e);}
  }
  async function syncWriting(day,text) {
    state.writing[day]=text;
    try { if(cloud()) await required(client.from('daily_writing').upsert({user_id:user.id,day,content:text,word_count:countWords(text),updated_at:new Date().toISOString()},{onConflict:'user_id,day'}));else localSave();
      setSyncMessage('Saved');
    }catch(e){setSyncMessage('Not saved');noteError(e);}
  }
  async function syncReading(){
    try {if(cloud())await Promise.all([
      required(client.from('daily_readings').upsert({user_id:user.id,day:activeDay,chapters:state.readings[activeDay],updated_at:new Date().toISOString()},{onConflict:'user_id,day'})),
      required(client.from('daily_profiles').update({reading_index:state.readingIndex,updated_at:new Date().toISOString()}).eq('user_id',user.id))
    ]);else localSave();}catch(e){noteError(e);}
  }
  async function saveProfile(){try{if(cloud())await required(client.from('daily_profiles').update({reading_index:state.readingIndex,settings:state.settings,updated_at:new Date().toISOString()}).eq('user_id',user.id));else localSave();}catch(e){noteError(e);}}
  function dailyHabitsHeading(){const name=String(state.settings?.preferredName||'').trim();return name?`${name}’s Daily Habits`:'Your daily practices';}
  function setSyncMessage(m){const el=document.querySelector('#sync-message');if(el)el.textContent=m;}
  const title = (x) => `<div class="eyebrow">KNOWN FORMATION LABS</div><h1 class="headline">${x}</h1>`;
  function header(){return `<div class="topbar"><div class="brand"><div class="mark">K</div><div><div class="brand-title">KNOWN <span style="font-weight:normal;color:#6b8b79">daily.</span></div><div class="brand-small">Formation Labs · Pay Attention</div></div></div><div class="top-actions"><button class="pill" data-view="settings" title="Open your account and settings"><span class="pill-dot ${cloud()?'cloud':''}"></span>${cloud()?'Synced':'This device'}</button><button class="iconbutton" aria-label="Settings" data-view="settings">⚙</button></div></div><nav class="tabs" aria-label="Main navigation"><button class="tab ${view==='today'?'current':''}" data-view="today">Today</button><button class="tab ${view==='history'?'current':''}" data-view="history">History</button><button class="tab ${view==='settings'?'current':''}" data-view="settings">Customize</button></nav>`;}
  function render(){
    if(!state)return;
    photoUrls.forEach(u=>URL.revokeObjectURL(u));photoUrls=[];
    root.innerHTML=`<div class="app-shell">${header()}${view==='today'?renderToday():view==='writing'?renderWriting():view==='reading'?renderReading():view==='activity'?renderActivity():view==='history'?renderHistory():renderSettings()}<footer class="footer">SMALL DAILY PRACTICES. A LIFE OF FORMATION. · KNOWN FORMATION LABS</footer></div>`;
    if(view==='today'||view==='history')loadPhotoPreviews();
    if(view==='reading')queueMicrotask(()=>{if(versionsStatus==='idle')loadVersions();else if(versionsStatus==='ready'&&bibleRequested!==requestKey()&&versions.length)loadChapter();});
    if(view==='reading'&&activeDay===todayString()&&currentReadingIndex()!=null)queueMicrotask(()=>{if(versionsStatus==='idle')loadVersions();else if(versionsStatus==='ready'&&bibleRequested!==requestKey()&&versions.length)loadChapter();});
    if(view==='settings')updateReadingPreview();
    if(view==='writing'){const editor=document.querySelector('#writing-editor');if(editor)editor.value=state.writing[activeDay]||'';}
  }
  function renderToday(){
    const num=dayDone(), total=state.habits.length;
    return `<div class="today-layout"><aside class="left-rail">
      <div class="eyebrow">A rhythm for becoming</div>
      <h1 class="headline">Be present.<br/>Build purpose.</h1>
      <p class="subtle">One intentional day at a time.</p>
      <div class="datebar"><button class="iconbutton" aria-label="Previous day" data-action="prev-day">‹</button><div class="date-name">${longDate(activeDay)}<div class="small-label">${activeDay===todayString()?'Today':'Your daily record'}</div></div><button class="iconbutton" aria-label="Next day" data-action="next-day" ${activeDay>=todayString()?'disabled':''}>›</button></div>
      <div class="card overview"><div class="eyebrow">Daily progress</div><div class="percentage">${pct()}%</div><div class="subtle">${num} of ${total} habits completed</div><div class="progress-track"><div class="progress-fill" style="width:${pct()}%"></div></div></div>
      <div class="card quote"><small>A guiding idea</small><p>“Pay attention to the life you are forming.”</p><small>Known Formation Labs</small></div>
    </aside><main><div class="section-header"><h2 class="section-title">${escapeHTML(dailyHabitsHeading())}</h2><button class="text-button" data-view="settings">+ Customize</button></div><div class="habit-list">
      ${state.habits.map(h=>{const done=isDone(h);let extra='';if(h.kind==='reading')extra=`${(state.readings[activeDay]||[]).length} / ${h.goal} chapters`;if(h.kind==='writing')extra=`${countWords(state.writing[activeDay]||'')} / ${h.goal} words`;
      ${state.habits.map(h=>{const done=isDone(h);let extra='';if(h.kind==='reading')extra=`${(state.readings[activeDay]||[]).length} chapters read${activeDay===todayString()?` · ${readingTarget()} assigned`:''}`;if(h.kind==='writing')extra=`${countWords(state.writing[activeDay]||'')} / ${h.goal} words`;
       return `<div class="card habit ${done?'completed':''}"><button class="habit-main" data-action="open-habit" data-id="${h.id}" aria-label="Open ${escapeHTML(h.title)}"><span class="habit-icon">${icons[h.kind]||'✓'}</span><span><span class="habit-title" style="display:block">${escapeHTML(h.title)}</span><span class="habit-detail">${extra||goalText(h)}</span></span><span class="habit-chevron">›</span></button><div class="check-wrap"><button class="check ${done?'done':''}" data-action="toggle-habit" data-id="${h.id}" aria-label="${done?'Completed':'Complete'} ${escapeHTML(h.title)}">✓</button></div></div>`;}).join('')}
      ${state.habits.length===0?'<div class="empty">Make this your own. Add a daily practice in Customize.</div>':''}</div>
      <button class="photo-slot" data-action="open-photo"><span class="photo-preview" data-photo-day="${activeDay}">${state.photos[activeDay]?'📷':'＋'}</span><span class="photo-copy"><strong>${state.photos[activeDay]?'Your moment, captured':'A picture of today'}</strong><small>${state.photos[activeDay]?'Tap to replace today’s photo':'Add one photo to remember this day'}</small></span><span style="margin-left:auto;color:#68927c">↗</span></button>
      <input id="photo-input" class="upload-input" type="file" accept="image/*" capture="environment" aria-label="Select your daily photo"/>
      <p class="note" style="padding:7px 3px">${cloud()?'Your data is private and synced to your Supabase account.':'Demo mode: data stays in this browser. Connect Supabase in Customize to sync devices.'}</p></main></div>`;
  }
  function renderWriting(){const h=state.habits.find(h=>h.kind==='writing'),goal=h?.goal||500, content=state.writing[activeDay]||'',count=countWords(content);
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('A space to write.')}<p class="subtle">${longDate(activeDay)} · Words collected, one day at a time.</p><section class="panel activity-panel"><div class="flex-between"><div><div class="eyebrow">Daily writing</div><h2 class="section-title">${goal} words</h2></div><span class="badge-small" id="sync-message">Saved draft</span></div><div class="progress-track" style="background:#e2eae0;margin:18px 0 20px"><div id="writing-progress" class="progress-fill" style="width:${Math.min(100,100*count/goal)}%;background:#61947a"></div></div><textarea id="writing-editor" class="editor" placeholder="Start with a thought, a prayer, an observation, or a few words about today…"></textarea><div class="editor-toolbar"><div><strong id="word-count">${count}</strong> <span class="small-label">/ ${goal} words</span></div><button id="writing-complete" class="primary" data-action="finish-writing" ${count<goal?'disabled':''}>${h&&isDone(h)?'✓ Completed':'Complete writing'}</button></div><p class="hint">Drafts save automatically. Completing becomes available when you reach your word goal.</p></section></main>`;
  }
  // Reading plans use separate bookmarks; switching plans never resets another plan.
  const READING_SECTIONS = {
    gospel:[39,40,41,42], law:[0,1,2,3,4], psalms:[18],
    letters:Array.from({length:21},(_,i)=>44+i), proverbs:[19],
    history:[...Array.from({length:12},(_,i)=>5+i),43],
    prophets:[...Array.from({length:17},(_,i)=>22+i),65], wisdom:[17,20,21]
  };
  const OTHER_SECTIONS=['law','psalms','letters','proverbs','history','prophets','wisdom'];
  const SECTION_NAMES={gospel:'Gospels',law:'Law',psalms:'Psalms',letters:'Epistles',proverbs:'Proverbs',history:'History & Acts',prophets:'Prophets & Revelation',wisdom:'Wisdom'};
  const SECTION_CHAPTERS=Object.fromEntries(Object.entries(READING_SECTIONS).map(([key,books])=>[key,books.flatMap(b=>{
    const start=BOOKS.slice(0,b).reduce((n,x)=>n+x[1],0);
    return Array.from({length:BOOKS[b][1]},(_,i)=>start+i);
  })]));
  const PLAN_NAMES={gospel:'Gospel-centered',year:'Whole Bible in a year',sequential:'Straight through'};
  const readingPlan = () => PLAN_NAMES[state.settings?.readingPlan]?state.settings.readingPlan:'gospel';
  const readingChapterGoal = () => Math.max(1,Math.min(100,Number(state.settings?.readingDailyChapters)||state.habits.find(h=>h.kind==='reading')?.goal||3));
  function planAssignment(plan,progress={},goal=3,legacyIndex=0){
    if(plan==='year'){
      const day=progress.day||0,index=progress.index||0;
      if(day>=365)return {indices:[],label:'365 readings complete',finished:true};
      const end=Math.floor((day+1)*CHAPTERS.length/365);
      return {indices:Array.from({length:Math.max(0,end-index)},(_,i)=>index+i),label:`Reading ${day+1} of 365`};
    }
    if(plan==='sequential')return {indices:Array.from({length:goal},(_,i)=>(legacyIndex+i)%CHAPTERS.length),label:'Genesis → Revelation'};
    const turn=progress.turn||0,section=turn%2===0?'gospel':OTHER_SECTIONS[Math.floor(turn/2)%OTHER_SECTIONS.length];
    const list=SECTION_CHAPTERS[section],cursor=progress.cursors?.[section]||0;
    const count=(progress.blockGoal||goal)-(progress.offset||0);
    return {indices:Array.from({length:count},(_,i)=>list[(cursor+i)%list.length]),label:SECTION_NAMES[section]};
  }
  function advancePlan(plan,progress={},goal=3){
    if(plan==='year'){
      const day=progress.day||0,index=(progress.index||0)+1;
      return {day:index>=Math.floor((day+1)*CHAPTERS.length/365)?day+1:day,index};
    }
    if(plan==='sequential')return progress;
    const turn=progress.turn||0,section=turn%2===0?'gospel':OTHER_SECTIONS[Math.floor(turn/2)%OTHER_SECTIONS.length];
    const blockGoal=progress.blockGoal||goal,offset=(progress.offset||0)+1;
    return {turn:turn+(offset>=blockGoal?1:0),offset:offset>=blockGoal?0:offset,blockGoal:offset>=blockGoal?null:blockGoal,
      cursors:{...progress.cursors,[section]:((progress.cursors?.[section]||0)+1)%SECTION_CHAPTERS[section].length}};
  }
  function currentAssignment(){
    const plan=readingPlan(),saved=state.settings?.readingAssignments?.[plan];
    if(saved?.day===activeDay)return saved;
    return {...planAssignment(plan,state.settings?.readingProgress?.[plan],readingChapterGoal(),state.readingIndex),day:activeDay,done:0};
  }
  function readingTarget(){const a=currentAssignment();return a.indices.length||readingChapterGoal();}
  function currentReadingIndex(){const a=currentAssignment();return a.indices[a.done]??null;}
  async function finishReadingChapter(){
    if(busy||activeDay!==todayString())return;
    const plan=readingPlan(),assignment=currentAssignment(),index=assignment.indices[assignment.done];
    if(index==null)return;
    busy=true;render();
    const oldState=state,ref=CHAPTERS[index],done=assignment.done+1;
    const settings={...state.settings,
      readingAssignments:{...state.settings.readingAssignments,[plan]:{...assignment,done}},
      readingProgress:{...state.settings.readingProgress,[plan]:advancePlan(plan,state.settings.readingProgress?.[plan],readingChapterGoal())}};
    const next={...state,settings,readings:{...state.readings,[activeDay]:[...(state.readings[activeDay]||[]),ref]},readingIndex:plan==='sequential'?state.readingIndex+1:state.readingIndex};
    try{
      if(cloud()){
        await required(client.from('daily_readings').upsert({user_id:user.id,day:activeDay,chapters:next.readings[activeDay],updated_at:new Date().toISOString()},{onConflict:'user_id,day'}));
        await required(client.from('daily_profiles').update({reading_index:next.readingIndex,settings,updated_at:new Date().toISOString()}).eq('user_id',user.id));
      }else localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      state=next;bibleRequested='';bibleContent=null;
      if(done===assignment.indices.length){
        for(const habit of state.habits.filter(h=>h.kind==='reading'&&!isDone(h)))await markComplete(habit,true,{chapters:next.readings[activeDay].length,plan});
      }
      toast(done===assignment.indices.length?'Reading complete for today!':`${ref} recorded`);
    }catch(err){state=oldState;noteError(err);}finally{busy=false;render();}
  }
  const chosenBible = () => versions.find(v=>v.id===state.settings?.bibleVersionId) || versions.find(v=>/^(NLT|NIV)$/i.test(v.abbreviation)) || versions[0];
  function nextChapterId(){const index=state.readingIndex%CHAPTERS.length,book=bookForIndex(index);const before=BOOKS.slice(0,book).reduce((n,x)=>n+x[1],0);return `${BOOK_IDS[book]}.${index-before+1}`;}
  function nextChapterId(){const index=currentReadingIndex();if(index==null)return '';const book=bookForIndex(index);const before=BOOKS.slice(0,book).reduce((n,x)=>n+x[1],0);return `${BOOK_IDS[book]}.${index-before+1}`;}
  function requestKey(){return `${chosenBible()?.id||''}:${nextChapterId()}`;}
  async function bibleFetch(query){
    if(!cloud())throw new Error('Sign in under Customize → Account & syncing to read Scripture inside KNOWN Daily.');
    const {data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw new Error('Sign in again to read Scripture.');
    const response=await fetch('/api/bible?'+query,{headers:{authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});
    const body=await response.json().catch(()=>({error:'The Bible server did not return JSON. Check your Vercel deployment.'}));
    if(!response.ok)throw new Error(body.error||`Unable to load Scripture (${response.status}).`);
    return body;
  }
  async function loadVersions(){
    if(!cloud()||versionsStatus==='loading'||versionsStatus==='ready')return;
    versionsStatus='loading';bibleError='';
    try {const result=await bibleFetch('mode=versions');versions=result.data||[];versionsStatus='ready';if(!versions.length)bibleError='No accessible English Bible editions were found. Enable NIV/NLT under API.Bible → Plan → Edit Bible Licenses.';}
    catch(err){versionsStatus='error';bibleError=err.message;}
    if(view==='reading')render();
    if(versionsStatus==='ready'&&versions.length)loadChapter();
  }
  async function loadChapter(){
    if(view!=='reading'||!cloud())return;
    if(view!=='reading'||!cloud()||activeDay!==todayString()||currentReadingIndex()==null)return;
    if(versionsStatus!=='ready'){if(versionsStatus==='idle')loadVersions();return;}
    const selected=chosenBible();if(!selected)return;
    const key=requestKey();if(bibleRequested===key)return;
    bibleRequested=key;bibleContent=null;bibleError='';render();
    try{
      const result=await bibleFetch(`mode=chapter&bibleId=${encodeURIComponent(selected.id)}&chapterId=${encodeURIComponent(nextChapterId())}`);
      if(bibleRequested!==key||view!=='reading')return;
      bibleContent=result.data;
      // API.Bible requires view tracking for browser apps. The v1 endpoint returns fumsId.
      if(result.meta?.fumsToken && typeof window.fums==='function'){
        window.fums('config',{userId:user.id});window.fums('trackView',result.meta.fumsToken);
      } else if(result.meta?.fumsId){
        const id=result.meta.fumsId,started=Date.now();
        const report=()=>{if(typeof window._BAPI?.t==='function'){window._BAPI.t(id);}else if(Date.now()-started<5000)setTimeout(report,200);else console.warn('API.Bible legacy view tracking library failed to load.');};
        report();
      }
    }catch(err){if(bibleRequested===key)bibleError=err.message;}
    if(view==='reading')render();
  }
  function renderReading(){
    const h=state.habits.find(h=>h.kind==='reading'),goal=h?.goal||3,read=state.readings[activeDay]||[];
    const current=CHAPTERS[state.readingIndex%CHAPTERS.length], selected=chosenBible();
    const external=`https://www.biblegateway.com/passage/?search=${encodeURIComponent(current)}&version=WEB`;
    if(activeDay!==todayString())return `<main class="view-stack"><button class="back" data-view="today">← Back to dashboard</button>${title('Your reading record.')}<p class="subtle">${longDate(activeDay)}</p><section class="panel"><h2 class="section-title">Chapters completed</h2><p class="muted-list">${(state.readings[activeDay]||[]).map(escapeHTML).join(' · ')||'No chapters recorded on this date.'}</p><p class="hint">Return to the current date on the dashboard to continue your reading plan.</p></section></main>`;
    const assignment=currentAssignment(),goal=assignment.indices.length,read=state.readings[activeDay]||[],index=currentReadingIndex();
    const current=index==null?null:CHAPTERS[index],selected=chosenBible(),complete=assignment.done>=goal;
    const external=current?`https://www.biblegateway.com/passage/?search=${encodeURIComponent(current)}&version=WEB`:'';
    const choices=versions.length?`<label class="form-label" style="max-width:360px">Bible translation <select id="bible-version" class="field">${versions.map(v=>`<option value="${escapeHTML(v.id)}" ${selected?.id===v.id?'selected':''}>${escapeHTML(v.abbreviation)} — ${escapeHTML(v.name)}</option>`).join('')}</select></label>`:'';
    const scripture=!cloud()?'<p class="subtle">To display licensed Scripture here, first sign in under Customize → Account & syncing. Your reading progress can still be tracked in demo mode.</p>':versionsStatus==='loading'?'<p class="subtle">Checking your available Bible translations…</p>':versionsStatus==='idle'?'<p class="subtle">Connecting to your Bible library…</p>':bibleContent&&bibleRequested===requestKey()?`<div class="scripture-body" aria-label="Bible chapter text">${escapeHTML(bibleContent.content)}</div><p class="scripture-copyright">${escapeHTML(bibleContent.copyright.replace(/<[^>]*>/g,''))}</p>`:bibleError?`<p class="error">${escapeHTML(bibleError)}</p><button class="secondary" data-action="retry-scripture">Try again</button>`:'<p class="subtle">Loading your chapter…</p>';
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('Make room for the Word.')}<p class="subtle">Read each chapter right here, and pick up tomorrow where you stop.</p><section class="panel activity-panel"><div class="eyebrow">${longDate(activeDay)}</div><div class="stat-row"><div class="stat"><div class="stat-number">${read.length}</div><div class="stat-caption">read today</div></div><div class="stat"><div class="stat-number">${goal}</div><div class="stat-caption">daily goal</div></div><div class="stat"><div class="stat-number">${state.readingIndex}</div><div class="stat-caption">chapters overall</div></div></div>${choices}<div class="scripture-card"><div class="step">Your next chapter</div><h2 class="reading-ref">${escapeHTML(current)}</h2>${scripture}<p class="note" style="margin-top:16px">If the reader is unavailable: <a href="${external}" target="_blank" rel="noopener noreferrer">open ${escapeHTML(current)} in Bible Gateway (WEB) ↗</a></p></div><button class="primary" data-action="read-chapter" style="width:100%">✓ I finished ${escapeHTML(current)}</button><p class="hint">After ${goal} chapters, your reading habit checks itself off. Your next chapter is remembered across days.</p>${read.length?`<div class="eyebrow" style="margin-top:22px">Chapters completed today</div><p class="muted-list">${read.map(escapeHTML).join(' · ')}</p>`:''}</section></main>`;
    const scripture=!cloud()?'<p class="subtle">To display licensed Scripture here, first sign in under Customize → Account & syncing. You can still read with the link below and record your progress.</p>':versionsStatus==='loading'?'<p class="subtle">Checking your available Bible translations…</p>':versionsStatus==='idle'?'<p class="subtle">Connecting to your Bible library…</p>':bibleContent&&bibleRequested===requestKey()?`<div class="scripture-body" aria-label="Bible chapter text">${escapeHTML(bibleContent.content)}</div><p class="scripture-copyright">${escapeHTML(bibleContent.copyright.replace(/<[^>]*>/g,''))}</p>`:bibleError?`<p class="error">${escapeHTML(bibleError)}</p><button class="secondary" data-action="retry-scripture">Try again</button>`:'<p class="subtle">Loading your chapter…</p>';
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('Make room for the Word.')}<p class="subtle">${PLAN_NAMES[readingPlan()]} · ${escapeHTML(assignment.label)}</p><section class="panel activity-panel"><div class="eyebrow">${longDate(activeDay)}</div><p class="subtle">${readingPlan()==='year'?'365 readings from Genesis to Revelation, with 3 or 4 chapters per reading. Missed or unfinished readings wait for you.':'Your bookmarks move when you finish chapters. Missed days never skip ahead.'}</p><div class="stat-row"><div class="stat"><div class="stat-number">${assignment.done}</div><div class="stat-caption">of ${goal} assigned chapters</div></div><div class="stat"><div class="stat-number">${Object.values(state.readings).reduce((n,v)=>n+v.length,0)}</div><div class="stat-caption">chapters recorded overall</div></div></div>
    ${goal?`<div class="eyebrow">This reading</div><p class="muted-list">${assignment.indices.map((i,n)=>`${n<assignment.done?'✓ ':''}${escapeHTML(CHAPTERS[i])}`).join(' · ')}</p>`:''}
    ${complete?`<div class="scripture-card"><h2 class="section-title">${assignment.finished?'You completed the whole Bible!':'Your reading is complete.'}</h2><p class="subtle">${assignment.finished?'All 1,189 chapters across 365 readings.':"Your next reading will be ready tomorrow. Take a moment to reflect on what stood out."}</p></div>`:`${choices}<div class="scripture-card"><div class="step">Your next chapter</div><h2 class="reading-ref">${escapeHTML(current)}</h2>${scripture}<p class="note" style="margin-top:16px">If the reader is unavailable: <a href="${external}" target="_blank" rel="noopener noreferrer">open ${escapeHTML(current)} in Bible Gateway (WEB) ↗</a></p></div><button class="primary" data-action="read-chapter" style="width:100%" ${busy||activeDay!==todayString()?'disabled':''}>${busy?'Saving…':`✓ I finished ${escapeHTML(current)}`}</button>`}
    <p class="hint">${activeDay!==todayString()?'Past dates are for reviewing your records. Return to Today to advance your plan.':'Finish the assigned reading to check off your Bible habit. An unfinished reading resumes where you stopped.'}</p><button class="text-button" data-view="settings">Change reading plan</button>${read.length?`<div class="eyebrow" style="margin-top:22px">Chapters completed on this date</div><p class="muted-list">${read.map(escapeHTML).join(' · ')}</p>`:''}</section></main>`;
  }
  function renderActivity(){const h=state.habits.find(h=>h.id===editHabit)||state.habits.find(h=>h.kind==='activity');if(!h){view='today';return renderToday();}
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('Keep moving.')}<p class="subtle">A little steady movement counts.</p><section class="panel activity-panel"><div class="eyebrow">${longDate(activeDay)}</div><h2 class="section-title">${escapeHTML(h.title)}</h2><p class="subtle">Your target is ${h.goal} minutes.</p><label class="form-label">Minutes active<input class="field" type="number" min="1" max="1440" id="activity-minutes" value="${h.goal}"/></label><button class="primary" data-action="log-activity" data-id="${h.id}">${isDone(h)?'Update completed activity':'Log activity and complete'}</button><p class="hint">This version logs your self-reported activity after meeting the goal. More detailed workouts can come later.</p></section></main>`;
  }
  function renderHistory(){const days=Array.from({length:21},(_,i)=>plusDays(todayString(),-i));const allPhotos=Object.keys(state.photos).sort().reverse();const last7=days.slice(0,7);
    return `<main class="view-stack">${title('Notice your growth.')}<p class="subtle">Every checkmark is one small act of attention. Review your consistency and the moments you captured.</p><div class="stat-row" style="margin:23px 0"><div class="stat"><div class="stat-number">${last7.reduce((n,d)=>n+dayDone(d),0)}</div><div class="stat-caption">habits, last 7 days</div></div><div class="stat"><div class="stat-number">${Object.values(state.writing).reduce((n,v)=>n+countWords(v),0)}</div><div class="stat-caption">total words written</div></div><div class="stat"><div class="stat-number">${Object.values(state.readings).reduce((n,v)=>n+v.length,0)}</div><div class="stat-caption">chapters read</div></div></div>
    <div class="section-header"><h2 class="section-title">Last 21 days</h2><button class="text-button" data-action="export">Export data ↗</button></div><div class="history-list">${days.map(d=>`<button data-action="jump-day" data-day="${d}" class="history-row" style="cursor:pointer;text-align:left;border:1px solid #e5ebe1"><span><strong style="font-size:13px">${longDate(d,{weekday:'short',month:'short',day:'numeric'})}</strong><div class="mini-track"><span style="width:${pct(d)}%"></span></div></span><span class="history-icons">${dayDone(d)} / ${state.habits.length} completed ${state.photos[d]?'· 📷':''}</span></button>`).join('')}</div>
    <div class="section-header" style="margin-top:27px"><h2 class="section-title">Daily photo journal</h2><span class="small-label">${allPhotos.length} moments</span></div>${allPhotos.length?`<div class="photo-grid">${allPhotos.slice(0,45).map(d=>`<button class="photo-cell" style="border:0;padding:0" data-action="jump-day" data-day="${d}" data-photo-day="${d}"><span>${d}</span></button>`).join('')}</div>`:'<div class="empty">Your daily pictures will appear here as a visual record of growth.</div>'}</main>`;
  }
  function renderPlanPreview(plan,goal){
    const descriptions={gospel:'Start with Matthew, then alternate Gospel readings with Law, Psalms, Epistles, Proverbs, History, Prophets and Wisdom. The Gospels continue through Mark, Luke and John, then repeat.',year:'Read the complete 66-book Bible from Genesis to Revelation in 365 readings. This plan sets its own goal of 3 or 4 chapters, instead of your custom chapter count. Read every day to finish in a year; missed days extend the finish date.',sequential:'Continue book by book from your existing straight-through bookmark, with your chosen daily chapter goal.'};
    const upcoming=planAssignment(plan,state.settings?.readingProgress?.[plan],goal,state.readingIndex);
    const example=upcoming.indices.map(i=>CHAPTERS[i]).join(' · ');
    return `<p class="subtle">${descriptions[plan]}</p><div class="auth-panel"><div class="eyebrow">Next reading · ${escapeHTML(upcoming.label)}</div><p class="muted-list">${escapeHTML(example||'Plan complete')}</p></div>`;
  }
  function updateReadingPreview(){const plan=document.querySelector('#reading-plan')?.value,goal=Number(document.querySelector('#reading-goal')?.value);if(!PLAN_NAMES[plan])return;document.querySelector('#reading-goal').disabled=plan==='year';document.querySelector('#reading-plan-preview').innerHTML=renderPlanPreview(plan,Math.max(1,Math.min(100,goal||3)));}
  function renderSettings(){const auth=cloud(),email=user?.email||'';
    return `<main class="view-stack">${title('Make it yours.')}<p class="subtle">Choose what matters. Adjust your practices as your season of life changes.</p>
    <section class="panel" style="margin-top:24px"><h2 class="section-title">Your name</h2><p class="subtle">Make your Today page feel like yours. Leave this blank to use the default heading.</p><form id="profile-form"><label class="form-label">Preferred name<input class="field" id="preferred-name" name="preferredName" maxlength="60" autocomplete="given-name" value="${escapeHTML(state.settings?.preferredName||'')}" placeholder="e.g. Dennis"/></label><p class="hint">${auth?'Your name syncs with your account across devices.':'Your name stays in this browser while using local demo mode.'}</p><button class="primary" type="submit">Save name</button></form></section>
    <section class="panel" style="margin-top:24px"><div class="flex-between"><h2 class="section-title">Your daily habits</h2><span class="badge-small">${state.habits.length} active</span></div><p class="subtle">Tap Edit to change a target, or add something new.</p>${state.habits.map(h=>`<div class="settings-habit"><span><strong>${escapeHTML(h.title)}</strong><br/><small>${goalText(h)}</small></span><div><button data-action="edit-habit" data-id="${h.id}">Edit</button> <button data-action="delete-habit" data-id="${h.id}" aria-label="Delete ${escapeHTML(h.title)}">✕</button></div></div>`).join('')}<button class="secondary" data-action="new-habit" style="margin-top:10px">+ Add a habit</button></section>
    <section class="panel" style="margin-top:17px"><h2 class="section-title">Bible reading plan</h2><p class="subtle">The default follows the 66-book Protestant Bible in order. Select your starting chapter to jump to another book.</p><div class="form-grid"><label class="form-label">Book<select class="field" id="book-select">${BOOKS.map(([b],i)=>`<option value="${i}" ${bookForIndex(state.readingIndex)===i?'selected':''}>${escapeHTML(b)}</option>`).join('')}</select></label><label class="form-label">Chapter<select class="field" id="chapter-select">${chapterOptions(bookForIndex(state.readingIndex),state.readingIndex)}</select></label></div><button class="secondary" data-action="set-reading-start">Set next chapter</button><p class="hint">Changing the starting point does not erase past reading records.</p></section>
    <section class="panel" style="margin-top:17px"><h2 class="section-title">Daily Bible reading</h2><form id="reading-plan-form"><label class="form-label">How many chapters per reading day?<input class="field" id="reading-goal" name="chapters" type="number" min="1" max="100" required value="${readingChapterGoal()}"/></label><label class="form-label">Choose your reading rhythm<select class="field" id="reading-plan" name="plan">${Object.entries(PLAN_NAMES).map(([key,name])=>`<option value="${key}" ${readingPlan()===key?'selected':''}>${name}${key==='gospel'?' (recommended)':''}</option>`).join('')}</select></label><div id="reading-plan-preview">${renderPlanPreview(readingPlan(),readingChapterGoal())}</div><button class="primary" type="submit">Save reading plan</button><p class="hint">Each plan remembers its own place. Switching plans preserves your reading history and other bookmarks. A changed chapter goal applies to the next new reading.</p></form></section>
    <section class="panel" style="margin-top:17px" id="account-panel"><h2 class="section-title">Account & syncing</h2>${auth?`<div class="auth-panel"><div class="eyebrow">✓ Secure cloud mode</div><p class="subtle">Signed in as <strong>${escapeHTML(email)}</strong>. Your data syncs through your Supabase project.</p><button class="secondary" data-action="refresh">Refresh from cloud</button> <button class="danger" data-action="sign-out">Sign out</button></div>`:configured?`<div class="auth-panel"><div class="eyebrow">Optional — Sync across devices</div><p class="subtle">Currently in local demo mode. Sign in by email to use the private Supabase database. Demo data is not migrated automatically.</p><form id="login-form" class="login-email"><label class="form-label">Email address<input class="field" id="login-email" type="email" required placeholder="you@example.com"/></label><button class="primary" type="submit">Email me a sign-in link</button></form></div>`:`<div class="auth-panel"><div class="eyebrow">Local demo mode</div><p class="subtle">This installation is not yet linked to Supabase. Your habits and writing stay in this browser, and photos use this device's browser storage.</p><p class="note">To enable private cross-device sync, complete the instructions in README.md and fill in config.js before deploying.</p></div>`}<div class="flex-between"><div><strong style="font-size:13px">Export your records</strong><p class="note" style="margin:5px 0">Downloads habits, progress, reading and writing as JSON. Photos are not included.</p></div><button class="secondary" data-action="export">Export JSON</button></div></section>
    <div style="margin-top:20px;text-align:center" class="note">KNOWN Formation Labs · Version 0.1 · Built for meaningful daily formation, not perfect streaks.</div></main>`;
  }
  function bookForIndex(idx){let count=0;for(let i=0;i<BOOKS.length;i++){count+=BOOKS[i][1];if(idx%CHAPTERS.length <count)return i;}return 0;}
  function chapterOptions(b,idx){let before=BOOKS.slice(0,b).reduce((n,book)=>n+book[1],0);return Array.from({length:BOOKS[b][1]},(_,i)=>`<option value="${i+1}" ${idx%CHAPTERS.length===before+i?'selected':''}>${i+1}</option>`).join('');}
  function selectBookOptions(){const book=document.querySelector('#book-select'), chap=document.querySelector('#chapter-select');if(book&&chap)chap.innerHTML=chapterOptions(+book.value,state.readingIndex);}
  // Local photos live in IndexedDB, not the limited localStorage JSON quota.
  function dbOpen(){return new Promise((resolve,reject)=>{const request=indexedDB.open('known-daily-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function localPhotoPut(day,blob){const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(blob,day);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
  async function localPhotoGet(day){const db=await dbOpen();const result=await new Promise((resolve,reject)=>{const tx=db.transaction('photos');const q=tx.objectStore('photos').get(day);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});db.close();return result;}
  async function compressImage(file){const img=await createImageBitmap(file);const factor=Math.min(1,960/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);img.close?.();return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not compress this photo.')),'image/webp',0.75));}
  async function photoUpload(file){if(!file||!file.type.startsWith('image/'))return toast('Choose a photo to upload.',true);const day=activeDay;try{toast('Saving your photo…');const blob=await compressImage(file);
    if(cloud()){const path=`${user.id}/${day}.webp`;await required(client.storage.from('daily-photos').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'300'}));await required(client.from('daily_photos').upsert({user_id:user.id,day,path},{onConflict:'user_id,day'}));state.photos[day]=path;}
    else {await localPhotoPut(day,blob);state.photos[day]=`local:${day}`;localSave();}
    toast('Today’s photo saved');render();}catch(e){noteError(e);}}
  async function loadPhotoPreviews(){const nodes=[...root.querySelectorAll('[data-photo-day]')];await Promise.all(nodes.map(async el=>{const day=el.dataset.photoDay,path=state.photos[day];if(!path)return;
    try{let url;if(cloud()){const result=await required(client.storage.from('daily-photos').createSignedUrl(path,3600));url=result.signedUrl;}else{const blob=await localPhotoGet(day);if(!blob)return;url=URL.createObjectURL(blob);photoUrls.push(url);}
      if(!el.isConnected)return;let im=document.createElement('img');im.alt=`Photo from ${day}`;im.loading='lazy';im.src=url;if(el.classList.contains('photo-cell'))el.prepend(im);else {el.textContent='';el.appendChild(im);}
    }catch(e){console.warn('Photo preview unavailable',e);}}));}
  async function addOrEditHabit(form){const fd=new FormData(form),kind=String(fd.get('kind')),title=String(fd.get('title')).trim(),goal=+fd.get('goal'),time=String(fd.get('time')||'');if(!title||title.length>90){toast('Enter a title up to 90 characters.',true);return;}
    if(!['time','bed','reading','writing','activity','check'].includes(kind)){toast('Invalid habit type',true);return;}
    if(!Number.isFinite(goal)||goal<1||goal>10000){toast('Choose a goal from 1 to 10,000.',true);return;}
    const h=editHabit ? state.habits.find(h=>h.id===editHabit) : {id:uid(),position:state.habits.length};if(!h)return;
    Object.assign(h,{title,kind,goal:kind==='time'||kind==='bed'||kind==='check'?1:goal,targetTime:time});
    if(!editHabit)state.habits.push(h);view='settings';editHabit=null;render();try{await persistHabit(h);toast('Habit saved');}catch(e){noteError(e);}
  }
  function renderHabitForm(){const h=editHabit?state.habits.find(x=>x.id===editHabit):null;const pane=document.createElement('div');pane.id='habit-form-wrap';pane.className='panel';pane.style.marginTop='17px';pane.innerHTML=`<h2 class="section-title">${h?'Edit':'Add'} a habit</h2><form id="habit-form"><label class="form-label">Practice name<input class="field" name="title" maxlength="90" required value="${escapeHTML(h?.title||'')}" placeholder="e.g. Practice gratitude"/></label><label class="form-label">Type<select class="field" name="kind" id="kind-select">${[['check','Simple checklist'],['time','Morning wake time'],['bed','Bedtime'],['reading','Bible reading'],['writing','Writing space'],['activity','Activity minutes']].map(([k,v])=>`<option value="${k}" ${h?.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><div class="form-grid"><label class="form-label" id="goal-field">Daily quantity<input class="field" name="goal" type="number" min="1" max="10000" value="${h?.goal||1}"/></label><label class="form-label" id="time-field">Target time<input class="field" name="time" type="time" value="${h?.targetTime||'06:30'}"/></label></div><button type="submit" class="primary">Save practice</button> <button class="secondary" type="button" data-action="cancel-habit">Cancel</button></form>`;
    const account=document.querySelector('#account-panel');account.parentNode.insertBefore(pane,account);updateKindFields();pane.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function updateKindFields(){const k=document.querySelector('#kind-select')?.value;document.querySelector('#time-field')?.classList.toggle('hidden',!['time','bed'].includes(k));document.querySelector('#goal-field')?.classList.toggle('hidden',['time','bed','check'].includes(k));}
  function exportData(){const payload={app:'KNOWN Daily',version:1,exported_at:new Date().toISOString(),email:user?.email||null,...state,photos_note:'Photos are not included in this export. Download them separately from your private storage bucket or device.'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`known-daily-export-${todayString()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Data exported (without photos)');}
  async function handleClick(e){const button=e.target.closest('button');if(!button)return;
    if(button.dataset.view){if(view==='writing')await flushWriting();view=button.dataset.view;editHabit=null;render();window.scrollTo(0,0);return;}
    const action=button.dataset.action,id=button.dataset.id,h=state.habits.find(h=>h.id===id);
    if(!action)return;
    if(action==='prev-day'||action==='next-day'){activeDay=plusDays(activeDay,action==='prev-day'?-1:1);render();}
    else if(action==='open-habit'||action==='toggle-habit'){if(!h)return;const special=['writing','reading','activity'].includes(h.kind);if(special){view=h.kind;editHabit=h.id;render();window.scrollTo(0,0);}else markComplete(h,!isDone(h));}
    else if(action==='open-photo'){document.querySelector('#photo-input')?.click();}
    else if(action==='finish-writing'){await syncWriting(activeDay,document.querySelector('#writing-editor')?.value||state.writing[activeDay]||'');const wh=state.habits.find(h=>h.kind==='writing');if(wh&&countWords(state.writing[activeDay]||'')>=wh.goal){await markComplete(wh,true,{words:countWords(state.writing[activeDay])});toast('Writing complete for today!');}else toast('Keep writing to reach your goal.',true);}
    else if(action==='retry-scripture'){bibleRequested='';if(versionsStatus==='error')versionsStatus='idle';loadVersions();if(versionsStatus==='ready')loadChapter();}
    else if(action==='read-chapter'){if(busy)return;busy=true;button.disabled=true;try{const ref=CHAPTERS[state.readingIndex%CHAPTERS.length];if(!state.readings[activeDay])state.readings[activeDay]=[];state.readings[activeDay].push(ref);state.readingIndex++;await syncReading();const rh=state.habits.find(h=>h.kind==='reading');if(rh&&state.readings[activeDay].length>=rh.goal&&!isDone(rh))await markComplete(rh,true,{chapters:state.readings[activeDay].length});else render();toast(`${ref} recorded`);}finally{busy=false;}}
    else if(action==='read-chapter')await finishReadingChapter();
    else if(action==='log-activity'){const mins=+document.querySelector('#activity-minutes')?.value;if(!h)return;if(!Number.isFinite(mins)||mins<h.goal){toast(`Enter at least ${h.goal} minutes to complete this habit.`,true);return;}await markComplete(h,true,{minutes:mins});toast('Activity logged');}
    else if(action==='jump-day'){activeDay=button.dataset.day;view='today';render();window.scrollTo(0,0);}
    else if(action==='export')exportData();
    else if(action==='new-habit'||action==='edit-habit'){editHabit=action==='edit-habit'?id:null;document.querySelector('#habit-form-wrap')?.remove();renderHabitForm();}
    else if(action==='cancel-habit'){document.querySelector('#habit-form-wrap')?.remove();editHabit=null;}
    else if(action==='delete-habit'){if(!h||!confirm(`Delete “${h.title}”? This also removes its completion checkmarks.`))return;state.habits=state.habits.filter(x=>x.id!==id);state.completions=state.completions.filter(x=>x.habit_id!==id);render();try{await removeHabit(id);toast('Habit removed');}catch(err){noteError(err);}}
    else if(action==='set-reading-start'){const b=+document.querySelector('#book-select')?.value,chapter=+document.querySelector('#chapter-select')?.value;if(!BOOKS[b]||chapter<1||chapter>BOOKS[b][1])return;state.readingIndex=BOOKS.slice(0,b).reduce((n,x)=>n+x[1],0)+chapter-1;await saveProfile();toast('Reading plan updated');render();}
    else if(action==='sign-out'){try{await client.auth.signOut();user=null;versions=[];versionsStatus='idle';bibleContent=null;bibleRequested='';state=localLoad();view='today';render();toast('Signed out. Using local demo.');}catch(err){noteError(err);}}
    else if(action==='refresh'){try{await loadCloud();toast('Synced latest changes');}catch(err){noteError(err);}}
  }
  async function saveReadingPlan(form){
    const data=new FormData(form),plan=String(data.get('plan'));
    const goal=plan==='year'?readingChapterGoal():Number(data.get('chapters'));
    if(!PLAN_NAMES[plan]||!Number.isInteger(goal)||goal<1||goal>100){toast('Choose a whole number from 1 to 100 chapters.',true);return;}
    const button=form.querySelector('button[type="submit"]');button.disabled=true;
    const settings={...state.settings,readingPlan:plan,readingDailyChapters:goal};
    try{
      if(cloud())await required(client.from('daily_profiles').update({settings,updated_at:new Date().toISOString()}).eq('user_id',user.id));
      else localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,settings}));
      state.settings=settings;bibleRequested='';bibleContent=null;render();toast('Reading plan saved');
    }catch(err){noteError(err);button.disabled=false;}
  }
  async function flushWriting(){if(view!=='writing')return;const textarea=document.querySelector('#writing-editor');const pending=!!draftTimer;if(draftTimer){clearTimeout(draftTimer);draftTimer=null;}if(textarea&&(pending||state.writing[activeDay]!==textarea.value))await syncWriting(activeDay,textarea.value);}
  function handleInput(e){if(e.target.id==='writing-editor'){const content=e.target.value,number=countWords(content),wh=state.habits.find(h=>h.kind==='writing'),goal=wh?.goal||500;state.writing[activeDay]=content;document.querySelector('#word-count').textContent=number;document.querySelector('#writing-progress').style.width=`${Math.min(100,100*number/goal)}%`;const finish=document.querySelector('#writing-complete');finish.disabled=number<goal;setSyncMessage('Saving…');if(draftTimer)clearTimeout(draftTimer);draftTimer=setTimeout(()=>syncWriting(activeDay,content),850);
    } else if(e.target.id==='book-select'){selectBookOptions();}else if(e.target.id==='kind-select'){updateKindFields();}}
    } else if(['reading-plan','reading-goal'].includes(e.target.id)){updateReadingPreview();}else if(e.target.id==='kind-select'){updateKindFields();}}
  root.addEventListener('click',e=>{handleClick(e).catch(noteError);});
  root.addEventListener('input',handleInput);
  root.addEventListener('change',e=>{if(e.target.id==='photo-input')photoUpload(e.target.files[0]);else if(e.target.id==='bible-version'){state.settings.bibleVersionId=e.target.value;bibleRequested='';bibleContent=null;saveProfile();render();}});
  root.addEventListener('submit', async e=>{e.preventDefault();if(e.target.id==='profile-form'){
  root.addEventListener('submit', async e=>{e.preventDefault();if(e.target.id==='reading-plan-form'){await saveReadingPlan(e.target);}else if(e.target.id==='profile-form'){
      const preferredName=String(new FormData(e.target).get('preferredName')||'').trim();
      if(preferredName.length>60){toast('Enter a name up to 60 characters.',true);return;}
      const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
      const settings={...state.settings,preferredName};
      try{
        if(cloud())await required(client.from('daily_profiles').update({settings,updated_at:new Date().toISOString()}).eq('user_id',user.id));
        else localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,settings}));
        state.settings=settings;render();toast('Name saved');
      }catch(err){noteError(err);button.disabled=false;}
    }else if(e.target.id==='habit-form'){await addOrEditHabit(e.target);}else if(e.target.id==='login-form'){const email=document.querySelector('#login-email').value.trim();if(!client)return;try{const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;toast('Check your email for the sign-in link.');}catch(err){noteError(err);}}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushWriting().catch(console.error);else if(cloud()&&view==='today')loadCloud().catch(console.error);});
  async function start(){state=localLoad();render();if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
    if(C.url&&C.publishableKey&&!window.supabase){toast('Supabase library did not load. Using local demo.',true);return;}
    if(!configured)return;
    try{client=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const result=await client.auth.getSession();if(result.error)throw result.error;
      if(result.data.session?.user){user=result.data.session.user;await loadCloud();}
      client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user&&user?.id!==session.user.id){user=session.user;setTimeout(()=>loadCloud().then(()=>toast('Cloud sync is active')).catch(noteError),0);}if(event==='SIGNED_OUT'&&user){user=null;state=localLoad();render();}});
      render();
    }catch(err){noteError(err);user=null;state=localLoad();render();}
  }
  start();
})();
