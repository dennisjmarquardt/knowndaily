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
  let state, client, user=null, view='today', activeDay=todayString(), editHabit=null, draftTimer=null, activityDraft='30', busy=false, photoUrls=[], authMode='signup';
  const writingSaves=new Map(), completionSaves=new Set();
  const draftKey=(userId,day)=>`known-daily-unsynced:${userId}:${day}`;
  function cacheWriting(userId,day,content){
    try{localStorage.setItem(draftKey(userId,day),JSON.stringify({content,savedAt:Date.now()}));}
    catch{toast('Cannot retain a local writing backup. Export your writing.',true);}
  }
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
    // Insert defaults before the profile marker; if initialization fails, the next login can retry.
    if(!profile){
      const existing=await required(client.from('daily_habits').select('id').eq('user_id',user.id).limit(1));
      if(!existing.length){
        await required(client.from('daily_habits').insert(defaultHabits().map(h=>({...toHabitRow(h),user_id:user.id}))));
      }
      await required(client.from('daily_profiles').upsert({user_id:user.id,reading_index:0,settings:{}},{onConflict:'user_id'}));
      profile=await required(client.from('daily_profiles').select('*').eq('user_id',user.id).single());
    }
    // Avoid discarding a pending save when this device refreshes from cloud.
    await Promise.allSettled([...writingSaves.values()]);
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
    // An interrupted upload must not silently destroy a local writing draft.
    try{
      const prefix=`known-daily-unsynced:${user.id}:`;
      let recovered=false;
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(!key?.startsWith(prefix))continue;
        const day=key.slice(prefix.length);
        if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(day))continue;
        const draft=JSON.parse(localStorage.getItem(key)||'null');
        if(draft && typeof draft.content==='string' && draft.content!==state.writing[day]){
          // Prefer retention to silently replacing a possibly newer cloud draft.
          state.writing[day]=draft.content;recovered=true;
        }
      }
      if(recovered)toast('Unsynced writing recovered locally. Review and save your draft before switching devices.',true);
    }catch(e){console.warn('Could not inspect local recovery drafts',e);}
    render();
  }
  function toHabitRow(h) {return {id:h.id,title:h.title,kind:h.kind,goal:h.goal||1,target_time:h.targetTime||null,position:h.position||0};}
  async function persistHabit(h){if(cloud())await required(client.from('daily_habits').upsert({...toHabitRow(h),user_id:user.id}));else localSave();}
  async function removeHabit(id){if(cloud())await required(client.from('daily_habits').delete().eq('id',id).eq('user_id',user.id));else localSave();}
  const isDone = (h,day=activeDay) => state.completions.some(c=>c.habit_id===h.id&&c.day===day);
  const dayDone = (day=activeDay) => state.habits.filter(h=>isDone(h,day)).length;
  function pct(day=activeDay){return state.habits.length ? Math.round(100*dayDone(day)/state.habits.length) : 0;}
  async function markComplete(h,done,details={}) {
    const day=activeDay, key=`${h.id}:${day}`;
    if(completionSaves.has(key))return false;
    completionSaves.add(key);
    const before=state.completions.filter(c=>c.habit_id===h.id&&c.day===day);
    state.completions=state.completions.filter(c=>!(c.habit_id===h.id&&c.day===day));
    if(done)state.completions.push({habit_id:h.id,day,details});
    render();
    try{
      if(cloud()){
        if(done)await required(client.from('daily_completions').upsert({user_id:user.id,habit_id:h.id,day,details},{onConflict:'user_id,habit_id,day'}));
        else await required(client.from('daily_completions').delete().eq('user_id',user.id).eq('habit_id',h.id).eq('day',day));
      }else localSave();
      return true;
    }catch(e){
      state.completions=state.completions.filter(c=>!(c.habit_id===h.id&&c.day===day)).concat(before);
      render();noteError(e);return false;
    }finally{completionSaves.delete(key);}
  }
  async function syncWriting(day,text) {
    state.writing[day]=text;
    if(!cloud()){localSave();setSyncMessage('Saved on this device');return true;}
    const userId=user.id, key=`${userId}:${day}`;
    cacheWriting(userId,day,text);
    // Serialize all writes for a given day. Each queued operation saves the newest draft,
    // preventing an earlier request from finishing after a newer one.
    const preceding=writingSaves.get(key)||Promise.resolve();
    const operation=preceding.catch(()=>{}).then(async()=>{
      if(!user||user.id!==userId)throw new Error('Account changed before saving.');
      const latest=state.writing[day]||'';
      await required(client.from('daily_writing').upsert({user_id:userId,day,content:latest,word_count:countWords(latest),updated_at:new Date().toISOString()},{onConflict:'user_id,day'}));
      try{
        const cached=JSON.parse(localStorage.getItem(draftKey(userId,day))||'null');
        if(cached?.content===latest)localStorage.removeItem(draftKey(userId,day));
      }catch{}
      if(view==='writing'&&activeDay===day&&state.writing[day]===latest)setSyncMessage('Saved to cloud');
    });
    writingSaves.set(key,operation);
    try{await operation;return true;}
    catch(e){setSyncMessage('Not saved — draft retained on this device');noteError(e);return false;}
    finally{if(writingSaves.get(key)===operation)writingSaves.delete(key);}
  }
  async function syncReading(){
    try {if(cloud())await Promise.all([
      required(client.from('daily_readings').upsert({user_id:user.id,day:activeDay,chapters:state.readings[activeDay],updated_at:new Date().toISOString()},{onConflict:'user_id,day'})),
      required(client.from('daily_profiles').update({reading_index:state.readingIndex,updated_at:new Date().toISOString()}).eq('user_id',user.id))
    ]);else localSave();return true;}catch(e){noteError(e);return false;}
  }
  async function saveProfile(){try{if(cloud())await required(client.from('daily_profiles').update({reading_index:state.readingIndex,settings:state.settings,updated_at:new Date().toISOString()}).eq('user_id',user.id));else localSave();return true;}catch(e){noteError(e);return false;}}
  function setSyncMessage(m){const el=document.querySelector('#sync-message');if(el)el.textContent=m;}
  const title = (x) => `<div class="eyebrow">KNOWN FORMATION LABS</div><h1 class="headline">${x}</h1>`;
  function header(){return `<div class="topbar"><div class="brand"><div class="mark">K</div><div><div class="brand-title">KNOWN <span style="font-weight:normal;color:#6b8b79">daily.</span></div><div class="brand-small">Formation Labs · Pay Attention</div></div></div><div class="top-actions"><button class="pill" data-view="settings" title="Open your account and settings"><span class="pill-dot ${cloud()?'cloud':''}"></span>${cloud()?'Synced':configured?'Sign in / Create account':'Guest demo'}</button><button class="iconbutton" aria-label="Settings" data-view="settings">⚙</button></div></div><nav class="tabs" aria-label="Main navigation"><button class="tab ${view==='today'?'current':''}" data-view="today">Today</button><button class="tab ${view==='history'?'current':''}" data-view="history">History</button><button class="tab ${view==='settings'?'current':''}" data-view="settings">Customize</button></nav>`;}
  function render(){
    if(!state)return;
    photoUrls.forEach(u=>URL.revokeObjectURL(u));photoUrls=[];
    root.innerHTML=`<div class="app-shell">${header()}${view==='today'?renderToday():view==='writing'?renderWriting():view==='reading'?renderReading():view==='activity'?renderActivity():view==='history'?renderHistory():renderSettings()}<footer class="footer">SMALL DAILY PRACTICES. A LIFE OF FORMATION. · KNOWN FORMATION LABS</footer></div>`;
    if(view==='today'||view==='history')loadPhotoPreviews();
    if(view==='reading')queueMicrotask(()=>{if(versionsStatus==='idle')loadVersions();else if(versionsStatus==='ready'&&bibleRequested!==requestKey()&&versions.length)loadChapter();});
    if(view==='writing'){const editor=document.querySelector('#writing-editor');if(editor)editor.value=state.writing[activeDay]||'';}
  }
  function renderDailyQuote(){
    const library=window.KNOWN_DAILY_QUOTES;
    const quote=library?.dailyQuote?.(new Date());
    if(!quote)return '';
    return `<div class="card quote" data-daily-quote="${todayString()}">
      <small>Today's reflection</small>
      <p>“${escapeHTML(quote.text)}”</p>
      <div class="quote-attribution">— ${escapeHTML(quote.author)}</div>
      <div class="quote-source">${escapeHTML(quote.source)}${quote.url?` · <a href="${escapeHTML(quote.url)}" target="_blank" rel="noopener noreferrer">Read source ↗</a>`:''}</div>
      ${quote.nlt?`<div class="quote-credit">${escapeHTML(library.nltCredit)}</div>`:''}
    </div>`;
  }
  function renderToday(){
    const num=dayDone(), total=state.habits.length;
    return `<div class="today-layout"><aside class="left-rail">
      <div class="eyebrow">A rhythm for becoming</div>
      <h1 class="headline">Be present.<br/>Build purpose.</h1>
      <p class="subtle">One intentional day at a time.</p>
      <div class="datebar"><button class="iconbutton" aria-label="Previous day" data-action="prev-day">‹</button><div class="date-name">${longDate(activeDay)}<div class="small-label">${activeDay===todayString()?'Today':'Your daily record'}</div></div><button class="iconbutton" aria-label="Next day" data-action="next-day" ${activeDay>=todayString()?'disabled':''}>›</button></div>
      <div class="card overview"><div class="eyebrow">Daily progress</div><div class="percentage">${pct()}%</div><div class="subtle">${num} of ${total} habits completed</div><div class="progress-track"><div class="progress-fill" style="width:${pct()}%"></div></div></div>
      ${renderDailyQuote()}
    </aside><main><div class="section-header"><h2 class="section-title">Your daily practices</h2><button class="text-button" data-view="settings">+ Customize</button></div><div class="habit-list">
      ${state.habits.map(h=>{const done=isDone(h);let extra='';if(h.kind==='reading')extra=`${(state.readings[activeDay]||[]).length} / ${h.goal} chapters`;if(h.kind==='writing')extra=`${countWords(state.writing[activeDay]||'')} / ${h.goal} words`;
       return `<div class="card habit ${done?'completed':''}"><button class="habit-main" data-action="open-habit" data-id="${h.id}" aria-label="Open ${escapeHTML(h.title)}"><span class="habit-icon">${icons[h.kind]||'✓'}</span><span><span class="habit-title" style="display:block">${escapeHTML(h.title)}</span><span class="habit-detail">${extra||goalText(h)}</span></span><span class="habit-chevron">›</span></button><div class="check-wrap"><button class="check ${done?'done':''}" data-action="toggle-habit" data-id="${h.id}" aria-label="${done?'Completed':'Complete'} ${escapeHTML(h.title)}">✓</button></div></div>`;}).join('')}
      ${state.habits.length===0?'<div class="empty">Make this your own. Add a daily practice in Customize.</div>':''}</div>
      <button class="photo-slot" data-action="open-photo"><span class="photo-preview" data-photo-day="${activeDay}">${state.photos[activeDay]?'📷':'＋'}</span><span class="photo-copy"><strong>${state.photos[activeDay]?'Your moment, captured':'A picture of today'}</strong><small>${state.photos[activeDay]?'Tap to replace today’s photo':'Add one photo to remember this day'}</small></span><span style="margin-left:auto;color:#68927c">↗</span></button>
      <input id="photo-input" class="upload-input" type="file" accept="image/*,.heic,.heif" aria-label="Take or choose your daily photo"/>
      <p class="note" style="padding:7px 3px">${cloud()?'Your data is private and synced to your Supabase account.':'Demo mode: data stays in this browser. Connect Supabase in Customize to sync devices.'}</p></main></div>`;
  }
  function renderWriting(){const h=state.habits.find(h=>h.kind==='writing'),goal=h?.goal||500, content=state.writing[activeDay]||'',count=countWords(content);
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('A space to write.')}<p class="subtle">${longDate(activeDay)} · Words collected, one day at a time.</p><section class="panel activity-panel"><div class="flex-between"><div><div class="eyebrow">Daily writing</div><h2 class="section-title">${goal} words</h2></div><span class="badge-small" id="sync-message">Saved draft</span></div><div class="progress-track" style="background:#e2eae0;margin:18px 0 20px"><div id="writing-progress" class="progress-fill" style="width:${Math.min(100,100*count/goal)}%;background:#61947a"></div></div><textarea id="writing-editor" class="editor" placeholder="Start with a thought, a prayer, an observation, or a few words about today…"></textarea><div class="editor-toolbar"><div><strong id="word-count">${count}</strong> <span class="small-label">/ ${goal} words</span></div><button id="writing-complete" class="primary" data-action="finish-writing" ${count<goal?'disabled':''}>${h&&isDone(h)?'✓ Completed':'Complete writing'}</button></div><p class="hint">Drafts save automatically. Completing becomes available when you reach your word goal.</p></section></main>`;
  }
  const chosenBible = () => versions.find(v=>v.id===state.settings?.bibleVersionId) || versions.find(v=>/^(NLT|NIV)$/i.test(v.abbreviation)) || versions[0];
  function nextChapterId(){const index=state.readingIndex%CHAPTERS.length,book=bookForIndex(index);const before=BOOKS.slice(0,book).reduce((n,x)=>n+x[1],0);return `${BOOK_IDS[book]}.${index-before+1}`;}
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
    const choices=versions.length?`<label class="form-label" style="max-width:360px">Bible translation <select id="bible-version" class="field">${versions.map(v=>`<option value="${escapeHTML(v.id)}" ${selected?.id===v.id?'selected':''}>${escapeHTML(v.abbreviation)} — ${escapeHTML(v.name)}</option>`).join('')}</select></label>`:'';
    const scripture=!cloud()?'<p class="subtle">To display licensed Scripture here, first sign in under Customize → Account & syncing. Your reading progress can still be tracked in demo mode.</p>':versionsStatus==='loading'?'<p class="subtle">Checking your available Bible translations…</p>':versionsStatus==='idle'?'<p class="subtle">Connecting to your Bible library…</p>':bibleContent&&bibleRequested===requestKey()?`<div class="scripture-body" aria-label="Bible chapter text">${escapeHTML(bibleContent.content)}</div><p class="scripture-copyright">${escapeHTML(bibleContent.copyright.replace(/<[^>]*>/g,''))}</p>`:bibleError?`<p class="error">${escapeHTML(bibleError)}</p><button class="secondary" data-action="retry-scripture">Try again</button>`:'<p class="subtle">Loading your chapter…</p>';
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('Make room for the Word.')}<p class="subtle">Read each chapter right here, and pick up tomorrow where you stop.</p><section class="panel activity-panel"><div class="eyebrow">${longDate(activeDay)}</div><div class="stat-row"><div class="stat"><div class="stat-number">${read.length}</div><div class="stat-caption">read today</div></div><div class="stat"><div class="stat-number">${goal}</div><div class="stat-caption">daily goal</div></div><div class="stat"><div class="stat-number">${state.readingIndex}</div><div class="stat-caption">chapters overall</div></div></div>${choices}<div class="scripture-card"><div class="step">Your next chapter</div><h2 class="reading-ref">${escapeHTML(current)}</h2>${scripture}<p class="note" style="margin-top:16px">If the reader is unavailable: <a href="${external}" target="_blank" rel="noopener noreferrer">open ${escapeHTML(current)} in Bible Gateway (WEB) ↗</a></p></div><button class="primary" data-action="read-chapter" style="width:100%">✓ I finished ${escapeHTML(current)}</button><p class="hint">After ${goal} chapters, your reading habit checks itself off. Your next chapter is remembered across days.</p>${read.length?`<div class="eyebrow" style="margin-top:22px">Chapters completed today</div><p class="muted-list">${read.map(escapeHTML).join(' · ')}</p>`:''}</section></main>`;
  }
  function renderActivity(){const h=state.habits.find(h=>h.id===editHabit)||state.habits.find(h=>h.kind==='activity');if(!h){view='today';return renderToday();}
    return `<main class="view-stack"><button class="back" data-view="today">← Back to today</button>${title('Keep moving.')}<p class="subtle">A little steady movement counts.</p><section class="panel activity-panel"><div class="eyebrow">${longDate(activeDay)}</div><h2 class="section-title">${escapeHTML(h.title)}</h2><p class="subtle">Your target is ${h.goal} minutes.</p><label class="form-label">Minutes active<input class="field" type="number" min="1" max="1440" id="activity-minutes" value="${h.goal}"/></label><button class="primary" data-action="log-activity" data-id="${h.id}">${isDone(h)?'Update completed activity':'Log activity and complete'}</button><p class="hint">This version logs your self-reported activity after meeting the goal. More detailed workouts can come later.</p></section></main>`;
  }
  function renderHistory(){const days=Array.from({length:21},(_,i)=>plusDays(todayString(),-i));const allPhotos=Object.keys(state.photos).sort().reverse();const last7=days.slice(0,7);
    return `<main class="view-stack">${title('Notice your growth.')}<p class="subtle">Every checkmark is one small act of attention. Review your consistency and the moments you captured.</p><div class="stat-row" style="margin:23px 0"><div class="stat"><div class="stat-number">${last7.reduce((n,d)=>n+dayDone(d),0)}</div><div class="stat-caption">habits, last 7 days</div></div><div class="stat"><div class="stat-number">${Object.values(state.writing).reduce((n,v)=>n+countWords(v),0)}</div><div class="stat-caption">total words written</div></div><div class="stat"><div class="stat-number">${Object.values(state.readings).reduce((n,v)=>n+v.length,0)}</div><div class="stat-caption">chapters read</div></div></div>
    <div class="section-header"><h2 class="section-title">Last 21 days</h2><button class="text-button" data-action="export">Export data ↗</button></div><div class="history-list">${days.map(d=>`<button data-action="jump-day" data-day="${d}" class="history-row" style="cursor:pointer;text-align:left;border:1px solid #e5ebe1"><span><strong style="font-size:13px">${longDate(d,{weekday:'short',month:'short',day:'numeric'})}</strong><div class="mini-track"><span style="width:${pct(d)}%"></span></div></span><span class="history-icons">${dayDone(d)} / ${state.habits.length} completed ${state.photos[d]?'· 📷':''}</span></button>`).join('')}</div>
    <div class="section-header" style="margin-top:27px"><h2 class="section-title">Daily photo journal</h2><span class="small-label">${allPhotos.length} moments</span></div>${allPhotos.length?`<div class="photo-grid">${allPhotos.slice(0,45).map(d=>`<button class="photo-cell" style="border:0;padding:0" data-action="jump-day" data-day="${d}" data-photo-day="${d}"><span>${d}</span></button>`).join('')}</div>`:'<div class="empty">Your daily pictures will appear here as a visual record of growth.</div>'}</main>`;
  }
  function renderSettings(){const auth=cloud(),email=user?.email||'';
    return `<main class="view-stack">${title('Make it yours.')}<p class="subtle">Choose what matters. Adjust your practices as your season of life changes.</p>
    <section class="panel" style="margin-top:24px"><div class="flex-between"><h2 class="section-title">Your daily habits</h2><span class="badge-small">${state.habits.length} active</span></div><p class="subtle">Tap Edit to change a target, or add something new.</p>${state.habits.map(h=>`<div class="settings-habit"><span><strong>${escapeHTML(h.title)}</strong><br/><small>${goalText(h)}</small></span><div><button data-action="edit-habit" data-id="${h.id}">Edit</button> <button data-action="delete-habit" data-id="${h.id}" aria-label="Delete ${escapeHTML(h.title)}">✕</button></div></div>`).join('')}<button class="secondary" data-action="new-habit" style="margin-top:10px">+ Add a habit</button></section>
    <section class="panel" style="margin-top:17px"><h2 class="section-title">Bible reading plan</h2><p class="subtle">The default follows the 66-book Protestant Bible in order. Select your starting chapter to jump to another book.</p><div class="form-grid"><label class="form-label">Book<select class="field" id="book-select">${BOOKS.map(([b],i)=>`<option value="${i}" ${bookForIndex(state.readingIndex)===i?'selected':''}>${escapeHTML(b)}</option>`).join('')}</select></label><label class="form-label">Chapter<select class="field" id="chapter-select">${chapterOptions(bookForIndex(state.readingIndex),state.readingIndex)}</select></label></div><button class="secondary" data-action="set-reading-start">Set next chapter</button><p class="hint">Changing the starting point does not erase past reading records.</p></section>
    <section class="panel" style="margin-top:17px" id="account-panel"><h2 class="section-title">Account & syncing</h2>${authMode==='set-password'&&auth?`<div class="auth-panel"><h3 class="auth-heading">Choose a password</h3><p class="subtle">Your secure password-reset link is verified. Enter a new password to use on all your devices.</p><form id="password-update-form"><label class="form-label">New password<input class="field" id="new-password" type="password" autocomplete="new-password" minlength="8" required/></label><label class="form-label">Confirm password<input class="field" id="new-password-confirm" type="password" autocomplete="new-password" minlength="8" required/></label><button class="primary" type="submit">Save new password</button></form></div>`:auth?`<div class="auth-panel"><div class="eyebrow">✓ Secure cloud mode</div><p class="subtle">Signed in as <strong>${escapeHTML(email)}</strong>. Your data syncs through your Supabase project.</p><button class="secondary" data-action="refresh">Refresh from cloud</button> <button class="danger" data-action="sign-out">Sign out</button></div>`:configured?`<div class="auth-panel"><div class="eyebrow">Your KNOWN Daily account</div><h3 class="auth-heading">${authMode==='signup'?'Create your account':authMode==='reset'?'Reset your password':'Welcome back'}</h3><p class="subtle">${authMode==='signup'?'Create an account to securely save your habits, writing, and reading progress on all your devices.':authMode==='reset'?'We’ll send you a secure reset link to set a new password. This also works if your previous account used an email sign-in link.':'Sign in with the email and password associated with your KNOWN Daily account.'}</p><form id="login-form"><label class="form-label">Email address<input class="field" id="login-email" type="email" autocomplete="email" required placeholder="you@example.com"/></label>${authMode==='reset'?'':`<label class="form-label">Password<input class="field" id="login-password" type="password" autocomplete="${authMode==='signup'?'new-password':'current-password'}" minlength="8" required/></label>`}${authMode==='signup'?`<label class="form-label">Confirm password<input class="field" id="login-password-confirm" type="password" autocomplete="new-password" minlength="8" required/></label>`:''}<button class="primary" type="submit">${authMode==='signup'?'Create account':authMode==='reset'?'Send reset link':'Sign in'}</button></form><div class="auth-switch">${authMode==='signup'?'Already have an account?':authMode==='reset'?'Remember your password?':'New to KNOWN Daily?'} <button type="button" class="inline-button" data-action="auth-switch">${authMode==='signup'?'Sign in':authMode==='reset'?'Sign in':'Create account'}</button></div>${authMode==='signin'?`<div class="auth-switch"><button type="button" class="inline-button" data-action="forgot-password">Forgot your password? Set one here.</button></div>`:''}<p class="note">${authMode==='signup'?'You may need to confirm your email before signing in.':'You can still explore the limited guest demo on this device.'} Guest data does not automatically transfer to your account.</p></div>`:`<div class="auth-panel"><div class="eyebrow">Local demo mode</div><p class="subtle">This installation is not yet linked to Supabase. Your habits and writing stay in this browser, and photos use this device's browser storage.</p><p class="note">To enable private cross-device sync, complete the instructions in README.md and fill in config.js before deploying.</p></div>`}<div class="flex-between"><div><strong style="font-size:13px">Export your records</strong><p class="note" style="margin:5px 0">Downloads habits, progress, reading and writing as JSON. Photos are not included.</p></div><button class="secondary" data-action="export">Export JSON</button></div></section>
    <div style="margin-top:20px;text-align:center" class="note">KNOWN Formation Labs · Version 0.4 · Built for meaningful daily formation, not perfect streaks.</div></main>`;
  }
  function bookForIndex(idx){let count=0;for(let i=0;i<BOOKS.length;i++){count+=BOOKS[i][1];if(idx%CHAPTERS.length <count)return i;}return 0;}
  function chapterOptions(b,idx){let before=BOOKS.slice(0,b).reduce((n,book)=>n+book[1],0);return Array.from({length:BOOKS[b][1]},(_,i)=>`<option value="${i+1}" ${idx%CHAPTERS.length===before+i?'selected':''}>${i+1}</option>`).join('');}
  function selectBookOptions(){const book=document.querySelector('#book-select'), chap=document.querySelector('#chapter-select');if(book&&chap)chap.innerHTML=chapterOptions(+book.value,state.readingIndex);}
  // Local photos live in IndexedDB, not the limited localStorage JSON quota.
  function dbOpen(){return new Promise((resolve,reject)=>{const request=indexedDB.open('known-daily-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function localPhotoPut(day,blob){const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(blob,day);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
  async function localPhotoGet(day){const db=await dbOpen();const result=await new Promise((resolve,reject)=>{const tx=db.transaction('photos');const q=tx.objectStore('photos').get(day);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});db.close();return result;}
  // iPhone camera photos may arrive as HEIC/HEIF, JPEG, or with a missing MIME type.
  // Safari supports native HEIC decoding on recent iOS versions, but not every browser does.
  const isPhotoFile=file=>!!file&&(file.type.startsWith('image/')||/\\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name||''));
  const isHeicFile=file=>/image\\/(heic|heif)/i.test(file.type)||/\\.(heic|heif)$/i.test(file.name||'');
  async function decodeImage(file){
    if(typeof createImageBitmap==='function'){
      try {const bitmap=await createImageBitmap(file);return {image:bitmap,release:()=>bitmap.close?.()};}
      catch(error){console.warn('ImageBitmap decode failed, trying iPhone-compatible image fallback.',error);}
    }
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.src=url;
      if(typeof image.decode==='function')await image.decode();
      else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Unable to decode photo'));});
      return {image,release:()=>{}};
    }finally{URL.revokeObjectURL(url);}
  }
  async function compressImage(file){
    let source;
    try{source=await decodeImage(file);}
    catch{
      const heic=isHeicFile(file);
      throw new Error(heic?'This iPhone HEIC photo could not be opened in this browser. Try opening KNOWN Daily in an updated Safari, or on iPhone choose Settings → Camera → Formats → Most Compatible for future photos.':'This photo could not be opened. Please try a JPEG, PNG, or a new camera photo.');
    }
    try{
      const {image}=source;
      const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
      if(!width||!height)throw new Error('The photo has no readable dimensions.');
      const factor=Math.min(1,960/Math.max(width,height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*factor));
      canvas.height=Math.max(1,Math.round(height*factor));
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Your browser could not prepare the photo.');
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('The photo could not be compressed.')),'image/webp',0.75));
      if(blob.type!=='image/webp')throw new Error('This browser cannot convert photos to WebP. Please update your browser.');
      if(blob.size>3145728)throw new Error('The converted photo is too large (over 3 MB). Please try another image.');
      return blob;
    }finally{source.release();}
  }
  async function photoUpload(file){
    if(!file)return;
    if(!isPhotoFile(file))return toast('Choose a JPEG, HEIC, HEIF, PNG, or other supported image.',true);
    const day=activeDay;
    const input=document.querySelector('#photo-input');
    if(input)input.disabled=true;
    try{
      toast('Converting and saving your photo…');
      const blob=await compressImage(file);
      if(cloud()){
        const path=`${user.id}/${day}.webp`;
        await required(client.storage.from('daily-photos').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'300'}));
        await required(client.from('daily_photos').upsert({user_id:user.id,day,path},{onConflict:'user_id,day'}));
        state.photos[day]=path;
      }else{
        await localPhotoPut(day,blob);state.photos[day]=`local:${day}`;localSave();
      }
      toast('Photo saved successfully');render();
    }catch(e){
      console.error('Photo import error',e);
      toast(e?.message||'Photo could not be saved. Check your connection and try again.',true);
    }finally{
      if(input){input.value='';input.disabled=false;}
    }
  }
  async function loadPhotoPreviews(){const nodes=[...root.querySelectorAll('[data-photo-day]')];await Promise.all(nodes.map(async el=>{const day=el.dataset.photoDay,path=state.photos[day];if(!path)return;
    try{let url;if(cloud()){const result=await required(client.storage.from('daily-photos').createSignedUrl(path,3600));url=result.signedUrl;}else{const blob=await localPhotoGet(day);if(!blob)return;url=URL.createObjectURL(blob);photoUrls.push(url);}
      if(!el.isConnected)return;let im=document.createElement('img');im.alt=`Photo from ${day}`;im.loading='lazy';im.src=url;if(el.classList.contains('photo-cell'))el.prepend(im);else {el.textContent='';el.appendChild(im);}
    }catch(e){console.warn('Photo preview unavailable',e);}}));}
  async function addOrEditHabit(form){const fd=new FormData(form),kind=String(fd.get('kind')),title=String(fd.get('title')).trim(),goal=+fd.get('goal'),time=String(fd.get('time')||'');if(!title||title.length>90){toast('Enter a title up to 90 characters.',true);return;}
    if(!['time','bed','reading','writing','activity','check'].includes(kind)){toast('Invalid habit type',true);return;}
    if(!Number.isFinite(goal)||goal<1||goal>10000){toast('Choose a goal from 1 to 10,000.',true);return;}
    const h=editHabit ? state.habits.find(h=>h.id===editHabit) : {id:uid(),position:state.habits.length};if(!h)return;
    Object.assign(h,{title,kind,goal:kind==='time'||kind==='bed'||kind==='check'?1:goal,targetTime:time});
    if(!editHabit)state.habits.push(h);view='settings';editHabit=null;render();try{await persistHabit(h);toast('Habit saved');}catch(e){noteError(e);if(cloud())await loadCloud().catch(noteError);}
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
    else if(action==='finish-writing'){const saved=await syncWriting(activeDay,document.querySelector('#writing-editor')?.value||state.writing[activeDay]||'');if(!saved){toast('Writing not synced. Your local recovery draft was kept.',true);return;}const wh=state.habits.find(h=>h.kind==='writing');if(wh&&countWords(state.writing[activeDay]||'')>=wh.goal){if(await markComplete(wh,true,{words:countWords(state.writing[activeDay])}))toast('Writing complete for today!');}else toast('Keep writing to reach your goal.',true);}
    else if(action==='retry-scripture'){bibleRequested='';if(versionsStatus==='error')versionsStatus='idle';loadVersions();if(versionsStatus==='ready')loadChapter();}
    else if(action==='read-chapter'){if(busy)return;busy=true;button.disabled=true;const day=activeDay,oldIndex=state.readingIndex,oldRead=[...(state.readings[day]||[])];try{const ref=CHAPTERS[state.readingIndex%CHAPTERS.length];if(!state.readings[day])state.readings[day]=[];state.readings[day].push(ref);state.readingIndex++;if(!(await syncReading())){state.readingIndex=oldIndex;state.readings[day]=oldRead;render();return;}const rh=state.habits.find(h=>h.kind==='reading');if(rh&&state.readings[day].length>=rh.goal&&!isDone(rh)){if(await markComplete(rh,true,{chapters:state.readings[day].length}))toast(`${ref} recorded`);}else{render();toast(`${ref} recorded`);}}finally{busy=false;}}
    else if(action==='log-activity'){const mins=+document.querySelector('#activity-minutes')?.value;if(!h)return;if(!Number.isFinite(mins)||mins<h.goal){toast(`Enter at least ${h.goal} minutes to complete this habit.`,true);return;}await markComplete(h,true,{minutes:mins});toast('Activity logged');}
    else if(action==='jump-day'){activeDay=button.dataset.day;view='today';render();window.scrollTo(0,0);}
    else if(action==='export')exportData();
    else if(action==='new-habit'||action==='edit-habit'){editHabit=action==='edit-habit'?id:null;document.querySelector('#habit-form-wrap')?.remove();renderHabitForm();}
    else if(action==='cancel-habit'){document.querySelector('#habit-form-wrap')?.remove();editHabit=null;}
    else if(action==='delete-habit'){if(!h||!confirm(`Delete “${h.title}”? This also removes its completion checkmarks.`))return;try{if(cloud())await removeHabit(id);state.habits=state.habits.filter(x=>x.id!==id);state.completions=state.completions.filter(x=>x.habit_id!==id);if(!cloud())localSave();render();toast('Habit removed');}catch(err){noteError(err);}}
    else if(action==='set-reading-start'){const b=+document.querySelector('#book-select')?.value,chapter=+document.querySelector('#chapter-select')?.value;if(!BOOKS[b]||chapter<1||chapter>BOOKS[b][1])return;const previousIndex=state.readingIndex;state.readingIndex=BOOKS.slice(0,b).reduce((n,x)=>n+x[1],0)+chapter-1;if(await saveProfile()){toast('Reading plan updated');}else{state.readingIndex=previousIndex;}render();}
    else if(action==='auth-switch'){authMode=authMode==='signup'?'signin':authMode==='reset'?'signin':'signup';render();document.querySelector('#login-email')?.focus();}
    else if(action==='forgot-password'){authMode='reset';render();document.querySelector('#login-email')?.focus();}
    else if(action==='sign-out'){try{await client.auth.signOut();user=null;versions=[];versionsStatus='idle';bibleContent=null;bibleRequested='';state=localLoad();view='today';render();toast('Signed out. Using local demo.');}catch(err){noteError(err);}}
    else if(action==='refresh'){try{await flushWriting();await loadCloud();toast('Cloud refresh finished');}catch(err){noteError(err);}}
  }
  async function flushWriting(){if(view!=='writing')return;const textarea=document.querySelector('#writing-editor');const pending=!!draftTimer;if(draftTimer){clearTimeout(draftTimer);draftTimer=null;}if(textarea&&(pending||state.writing[activeDay]!==textarea.value))await syncWriting(activeDay,textarea.value);}
  function handleInput(e){if(e.target.id==='writing-editor'){const content=e.target.value,number=countWords(content),wh=state.habits.find(h=>h.kind==='writing'),goal=wh?.goal||500;state.writing[activeDay]=content;if(cloud())cacheWriting(user.id,activeDay,content);document.querySelector('#word-count').textContent=number;document.querySelector('#writing-progress').style.width=`${Math.min(100,100*number/goal)}%`;const finish=document.querySelector('#writing-complete');finish.disabled=number<goal;setSyncMessage('Saving…');if(draftTimer)clearTimeout(draftTimer);draftTimer=setTimeout(()=>syncWriting(activeDay,content),850);
    } else if(e.target.id==='book-select'){selectBookOptions();}else if(e.target.id==='kind-select'){updateKindFields();}}
  root.addEventListener('click',e=>{handleClick(e).catch(noteError);});
  root.addEventListener('input',handleInput);
  root.addEventListener('change',e=>{if(e.target.id==='photo-input')photoUpload(e.target.files[0]);else if(e.target.id==='bible-version'){state.settings.bibleVersionId=e.target.value;bibleRequested='';bibleContent=null;saveProfile();render();}});
  root.addEventListener('submit',async e=>{
    e.preventDefault();
    if(e.target.id==='habit-form'){await addOrEditHabit(e.target);return;}
    if(e.target.id==='password-update-form'){
      const password=document.querySelector('#new-password')?.value||'',confirmation=document.querySelector('#new-password-confirm')?.value||'';
      if(password.length<8||password!==confirmation){toast('Passwords must match and contain at least eight characters.',true);return;}
      try{
        const {error}=await client.auth.updateUser({password});if(error)throw error;
        authMode='signin';toast('Password updated successfully. Your account is ready.');render();
      }catch(err){noteError(err);}return;
    }
    if(e.target.id!=='login-form'||!client)return;
    const email=document.querySelector('#login-email')?.value.trim()||'';
    const password=document.querySelector('#login-password')?.value||'';
    const button=e.target.querySelector('[type="submit"]');
    if(button?.disabled)return;
    if(authMode==='signup' && (password.length<8||password!==document.querySelector('#login-password-confirm')?.value)){
      toast('Passwords must match and contain at least eight characters.',true);return;
    }
    if(authMode==='signin' && !password){toast('Enter your password.',true);return;}
    if(button)button.disabled=true;
    try{
      let result;
      if(authMode==='reset'){
        result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
        if(result.error)throw result.error;
        toast('If this email is registered, a password reset link will arrive shortly.');
      }else if(authMode==='signup'){
        result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
        if(result.error)throw result.error;
        toast(result.data?.session?'Account created and signed in.':'Check your email to confirm your new account.');
      }else{
        result=await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        toast('Signed in successfully.');
      }
    }catch(err){noteError(err);}
    finally{if(button)button.disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushWriting().catch(console.error);else if(cloud()&&view==='today')loadCloud().catch(console.error);});
  async function start(){state=localLoad();render();if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const recoveryLink=location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('type')==='recovery';
    if(C.url&&C.publishableKey&&!window.supabase){toast('Supabase library did not load. Using local demo.',true);return;}
    if(!configured)return;
    try{client=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const result=await client.auth.getSession();if(result.error)throw result.error;
      if(result.data.session?.user){user=result.data.session.user;await loadCloud();if(recoveryLink){authMode='set-password';view='settings';render();}}
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='PASSWORD_RECOVERY'){
          if(session?.user)user=session.user;
          authMode='set-password';view='settings';render();
          if(session?.user)setTimeout(()=>loadCloud().then(()=>{view='settings';render();}).catch(noteError),0);
          return;
        }
        if(event==='SIGNED_IN'&&session?.user&&user?.id!==session.user.id){
          user=session.user;setTimeout(()=>loadCloud().then(()=>toast('Cloud sync is active')).catch(noteError),0);
        }
        if(event==='SIGNED_OUT'&&user){user=null;authMode='signin';state=localLoad();render();}
      });
      render();
    }catch(err){noteError(err);user=null;state=localLoad();render();}
  }
  // Update the reflection on local date rollover without re-rendering an editor.
  setInterval(()=>{
    const card=root.querySelector('[data-daily-quote]');
    if(card && card.dataset.dailyQuote!==todayString())card.outerHTML=renderDailyQuote();
  },60000);
  start();
})();
