/* KNOWN Daily formation practices: private prayer, weekly gratitude, daily notes, optional on-device OCR. */
(() => {
  'use strict';
  const KEY='known-formation-demo-v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const startOfWeek=day=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()-d.getDay());return iso(d);};
  const empty=()=>({requests:[],updates:[],checkins:[],sessions:[],gratitude:[],notes:[]});
  const uuid=()=>crypto.randomUUID();
  const safeJSON=value=>{try{return JSON.parse(value);}catch{return null;}};
  let active=null, ocrFile=null, ocrText='';
  function status(message,error=false){
    const el=active?.target?.querySelector('#formation-status');
    if(el){el.textContent=message;el.className=error?'formation-error':'note';}
  }
  function demoLoad(){
    const value=safeJSON(localStorage.getItem(KEY)||'null');
    return value&&Array.isArray(value.requests)?Object.assign(empty(),value):empty();
  }
  function demoSave(){if(!active.user){try{localStorage.setItem(KEY,JSON.stringify(active.data));}catch{status('Device storage is full. Export important notes.',true);}}}
  async function must(promise){const r=await promise;if(r.error)throw r.error;return r.data;}
  async function load(){
    const a=active;
    if(!a.user){a.data=demoLoad();return;}
    const tables=['daily_prayer_requests','daily_prayer_updates','daily_prayer_checkins',
      'daily_prayer_sessions','daily_gratitude','daily_notes'];
    const rows=await Promise.all(tables.map(name=>must(a.client.from(name).select('*').eq('user_id',a.user.id))));
    if(active!==a)return;
    a.data=Object.fromEntries(['requests','updates','checkins','sessions','gratitude','notes'].map((k,i)=>[k,rows[i]||[]]));
    const backupKey='known-formation-draft:'+a.user.id+':'+a.day;
    const backup=localStorage.getItem(backupKey);
    if(backup!==null){
      const existing=a.data.notes.find(n=>n.day===a.day);
      if(!existing || existing.content!==backup){
        if(existing)existing.content=backup;
        else a.data.notes.push({day:a.day,content:backup,photo_path:null});
        a.recoveredDraft=true;
      }
    }
  }
  const n=(tag,inner,cls)=>{const e=document.createElement(tag);e.innerHTML=inner;if(cls)e.className=cls;return e;};
  const tab=(id,label,active)=>'<button class="secondary formation-tab '+(active===id?'formation-selected':'')+'" type="button" data-formation-tab="'+id+'">'+label+'</button>';
  const head=()=>'<div class="eyebrow">Known Formation Labs</div><h1 class="headline">Practices of formation.</h1>'+
    '<p class="subtle">Small, faithful attentions to people, gratitude, and the life you are becoming.</p>'+
    '<div class="formation-tabs">'+tab('prayer','Prayer',active.mode)+tab('gratitude','Weekly gratitude',active.mode)+tab('notes','Daily notes',active.mode)+'</div>'+
    '<p id="formation-status" class="note" role="status" aria-live="polite"></p>';
  function requestCard(r){
    const d=active.data, day=active.day, checked=d.checkins.some(c=>c.request_id===r.id&&c.day===day);
    const updates=d.updates.filter(x=>x.request_id===r.id).sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)));
    return '<article class="formation-request">'+
      '<div class="flex-between"><div><strong>'+esc(r.person)+'</strong><p class="note">'+esc(r.request_text)+'</p></div>'+
      '<span class="badge-small">'+esc(r.status)+'</span></div>'+
      (r.status==='active'?'<label class="formation-check"><input type="checkbox" data-prayer-check="'+esc(r.id)+'" '+(checked?'checked':'')+'/> Prayed for today</label>':'')+
      '<div class="formation-actions">'+
      '<button class="secondary" data-request-action="edit" data-request-id="'+esc(r.id)+'">Edit</button>'+
      '<button class="secondary" data-request-action="update" data-request-id="'+esc(r.id)+'">Add update</button>'+
      (r.status==='active'?'<button class="secondary" data-request-action="answered" data-request-id="'+esc(r.id)+'">Answered</button>':'')+
      '<button class="secondary" data-request-action="'+(r.status==='archived'?'restore':'archive')+'" data-request-id="'+esc(r.id)+'">'+(r.status==='archived'?'Restore':'Archive')+'</button>'+
      '</div>'+
      (updates.length?'<details><summary>History · '+updates.length+' update(s)</summary>'+
       updates.map(u=>'<div class="formation-update"><small>'+esc(new Date(u.created_at).toLocaleDateString())+'</small><p>'+esc(u.content)+'</p></div>').join('')+
       '</details>':'')+'</article>';
  }
  function prayer(){
    const day=active.day, d=active.data, session=d.sessions.find(s=>s.day===day), goal=10,
      minutes=session?.minutes||0, checked=d.checkins.filter(c=>c.day===day).length;
    const activeRequests=d.requests.filter(r=>r.status==='active').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const other=d.requests.filter(r=>r.status!=='active');
    return '<section class="panel"><h2 class="section-title">Daily prayer</h2>'+
      '<p class="subtle">A living prayer journal, not just a task list. You can record prayer time without checking off every request.</p>'+
      '<form id="formation-minutes"><label class="form-label">Minutes of prayer today'+
      '<input class="field" name="minutes" type="number" min="0" max="1440" value="'+minutes+'" required/></label>'+
      '<p class="note">'+minutes+' / '+goal+' minute goal</p><button class="primary" type="submit">Save prayer time</button></form></section>'+
      '<section class="panel formation-section"><h2 class="section-title">People and requests</h2>'+
      '<p class="subtle">'+checked+' marked as prayed for today · '+activeRequests.length+' active requests</p>'+
      '<form id="formation-add-request"><label class="form-label">Person or subject<input class="field" name="person" maxlength="160" required placeholder="Person, family, community, or situation"/></label>'+
      '<label class="form-label">Prayer request<textarea class="field" name="request" maxlength="8000" rows="3" required placeholder="What are you praying for?"></textarea></label>'+
      '<button class="primary" type="submit">Add prayer request</button></form>'+
      '<div class="formation-list">'+(activeRequests.length?activeRequests.map(requestCard).join(''):'<p class="note">Your active requests will appear here.</p>')+'</div>'+
      (other.length?'<details><summary>Answered and archived requests ('+other.length+')</summary>'+
        other.map(requestCard).join('')+'</details>':'')+'</section>';
  }
  function gratitude(){
    const key=startOfWeek(active.day), row=active.data.gratitude.find(g=>g.week_start===key),
      items=Array.from({length:10},(_,i)=>row?.items?.[i]||''),
      completed=items.filter(x=>x.trim()).length;
    return '<section class="panel"><div class="eyebrow">Weekly · Sunday to Saturday</div>'+
      '<h2 class="section-title">Ten things I am grateful for.</h2>'+
      '<p class="subtle">Reflect once each week. You can return and update the list throughout the week.</p>'+
      '<p class="badge-small">'+completed+' of 10 items</p>'+
      '<form id="formation-gratitude">'+items.map((v,i)=>
        '<label class="form-label">'+(i+1)+'. Something I am grateful for'+
        '<input class="field" type="text" name="item" maxlength="500" value="'+esc(v)+'" placeholder="A gift, moment, person, or provision..."/></label>'
      ).join('')+'<button class="primary" type="submit">Save this week’s gratitude</button></form>'+
      (completed===10?'<p class="note">✓ You have recorded ten reasons for gratitude this week.</p>':'')+
      '</section>';
  }
  function notes(){
    const day=active.day,row=active.data.notes.find(n=>n.day===day),content=row?.content||'';
    return '<section class="panel"><div class="eyebrow">Daily notes · '+esc(day)+'</div>'+
      '<h2 class="section-title">Notice, capture, remember.</h2>'+
      '<p class="subtle">Write freely, or add a photo of a notebook page and attempt local text recognition.</p>'+
      '<label class="form-label" for="formation-notes-text">Your notes</label>'+
      '<textarea id="formation-notes-text" class="editor" rows="8" placeholder="What deserves your attention today?">'+esc(content)+'</textarea>'+
      '<div class="formation-actions"><button class="primary" data-notes-save="1">Save notes</button><small id="formation-notes-status">Drafts save to this device until cloud sync succeeds.</small></div>'+
      '<label class="form-label">Photograph written notes<input class="field" id="formation-notes-file" type="file" accept="image/*,.heic,.heif"/></label>'+
      '<div class="formation-actions"><button class="secondary" data-notes-upload="1">Upload photo</button>'+
      '<button class="secondary" data-notes-ocr="1">Extract text (free OCR)</button></div>'+
      '<p class="note">OCR runs on this device and is best for printed text. Handwriting and cursive may be inaccurate. Always review before saving.</p>'+
      '<div id="formation-photo-preview"></div>'+
      '<div id="formation-ocr-preview">'+(ocrText?ocrPreview():'')+'</div></section>';
  }
  function ocrPreview(){
    return '<label class="form-label">Review recognized text<textarea class="editor" id="formation-ocr-text" rows="5">'+esc(ocrText)+'</textarea></label>'+
      '<button class="primary" data-notes-append="1">Append reviewed text to notes</button>';
  }
  function render(){
    if(!active?.target?.isConnected)return;
    active.target.innerHTML=head()+(active.mode==='prayer'?prayer():active.mode==='gratitude'?gratitude():notes());
    if(active.mode==='notes')showNotePhoto().catch(e=>status(e.message,true));
    if(active.recoveredDraft){status('An unsynced note draft was recovered from this device. Review it and tap Save notes.',true);active.recoveredDraft=false;}
  }
  async function save(table,row,conflict){
    if(!active.user){demoSave();return;}
    await must(active.client.from(table).upsert(row,{onConflict:conflict}));
  }
  async function showNotePhoto(){
    const target=active.target.querySelector('#formation-photo-preview');
    const row=active.data.notes.find(n=>n.day===active.day);
    if(!target||!row?.photo_path)return;
    if(!active.user){target.textContent='Guest photo previews are temporary. Sign in to save them across devices.';return;}
    const signed=await must(active.client.storage.from('daily-note-photos').createSignedUrl(row.photo_path,600));
    if(!target.isConnected)return;
    const img=document.createElement('img');img.alt='Photographed notes for this day';img.className='formation-photo';img.src=signed.signedUrl;
    target.replaceChildren(img);
  }
  async function storeNote(content,photoPath){
    const a=active, day=a.day;
    let row=a.data.notes.find(n=>n.day===day);
    if(!row){row={user_id:a.user?.id,day,content:'',photo_path:null};a.data.notes.push(row);}
    row.content=content;
    if(photoPath!==undefined)row.photo_path=photoPath;
    const backupKey='known-formation-draft:'+(a.user?.id||'guest')+':'+day;
    localStorage.setItem(backupKey,content);
    try{
      await save('daily_notes',{user_id:a.user?.id,day,content,photo_path:row.photo_path,updated_at:new Date().toISOString()},'user_id,day');
      localStorage.removeItem(backupKey);
      status(a.user?'Notes saved to your account.':'Notes saved in this browser.');
      demoSave();
      return true;
    }catch(e){status('Notes could not sync. Your draft remains on this device. '+e.message,true);return false;}
  }
  async function requestAction(action,id){
    const a=active,r=a.data.requests.find(x=>x.id===id);
    if(!r)return;
    if(action==='update'){
      const message=prompt('Add a dated update to this prayer request:');
      if(!message?.trim())return;
      const row={id:uuid(),user_id:a.user?.id,request_id:id,content:message.trim(),created_at:new Date().toISOString()};
      await save('daily_prayer_updates',row,'id');a.data.updates.push(row);
    }else{
      let changes={};
      if(action==='edit'){
        const person=prompt('Person or subject:',r.person);if(person===null||!person.trim())return;
        const request_text=prompt('Prayer request:',r.request_text);if(request_text===null||!request_text.trim())return;
        changes={person:person.trim(),request_text:request_text.trim()};
      }else if(action==='answered'){
        const answer=prompt('How was this prayer answered? Add a note (optional):');
        if(answer===null)return;
        changes={status:'answered',answered_at:new Date().toISOString()};
        if(answer.trim()){
          const row={id:uuid(),user_id:a.user?.id,request_id:id,content:'Answered: '+answer.trim(),created_at:new Date().toISOString()};
          await save('daily_prayer_updates',row,'id');a.data.updates.push(row);
        }
      }else if(action==='archive')changes={status:'archived'};
      else if(action==='restore')changes={status:'active',answered_at:null};
      if(a.user)await must(a.client.from('daily_prayer_requests').update({...changes,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',a.user.id));
      Object.assign(r,changes);
    }
    demoSave();render();status('Prayer request updated.');
  }
  async function click(e){
    const target=e.target.closest('button');
    if(!target)return;
    try{
      if(target.dataset.formationTab){
        active.mode=target.dataset.formationTab;ocrText='';render();return;
      }
      if(target.dataset.requestAction){await requestAction(target.dataset.requestAction,target.dataset.requestId);return;}
      if(target.dataset.notesSave){
        await storeNote(active.target.querySelector('#formation-notes-text').value);return;
      }
      if(target.dataset.notesUpload){
        const file=active.target.querySelector('#formation-notes-file')?.files?.[0];
        if(!file)throw new Error('First select a photograph of your notes.');
        if(!active.user)throw new Error('Sign in to store a private notes photograph.');
        if(!active.compressImage)throw new Error('The photo importer is unavailable.');
        status('Converting and uploading your photograph...');
        const blob=await active.compressImage(file);
        const path=active.user.id+'/'+active.day+'.webp';
        await must(active.client.storage.from('daily-note-photos').upload(path,blob,{upsert:true,contentType:'image/webp'}));
        const text=active.target.querySelector('#formation-notes-text')?.value||'';
        await storeNote(text,path);
        render();status('Photographed page saved privately.');
        return;
      }
      if(target.dataset.notesOcr){
        let file=active.target.querySelector('#formation-notes-file')?.files?.[0];
        if(!file){
          const row=active.data.notes.find(n=>n.day===active.day);
          if(!active.user||!row?.photo_path)throw new Error('Select or upload a notes photograph first.');
          const signed=await must(active.client.storage.from('daily-note-photos').createSignedUrl(row.photo_path,180));
          file=await (await fetch(signed.signedUrl)).blob();
        }
        target.disabled=true;status('Loading free OCR and recognizing text on your device...');
        if(!window.Tesseract){
          await new Promise((resolve,reject)=>{
            const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload=resolve;script.onerror=()=>reject(new Error('The free OCR library could not load.'));document.head.append(script);
          });
        }
        const converted=active.compressImage?await active.compressImage(file):file;
        const result=await window.Tesseract.recognize(converted,'eng');
        ocrText=result.data?.text?.trim()||'';
        render();
        status(ocrText?'Review the detected text before adding it to your notes.':'No readable text found; try a clearer photograph.',!ocrText);
        return;
      }
      if(target.dataset.notesAppend){
        const recognized=active.target.querySelector('#formation-ocr-text')?.value.trim()||'';
        const editor=active.target.querySelector('#formation-notes-text');
        editor.value=[editor.value.trim(),recognized].filter(Boolean).join('\n\n');
        ocrText='';active.target.querySelector('#formation-ocr-preview').innerHTML='';
        status('Recognized text added to your draft. Tap Save notes to sync.');
      }
    }catch(err){status(err.message||'Unable to complete this action.',true);}
    finally{if(target.dataset.notesOcr)target.disabled=false;}
  }
  async function submit(e){
    if(!['formation-minutes','formation-add-request','formation-gratitude'].includes(e.target.id))return;
    e.preventDefault();
    const a=active,f=new FormData(e.target);
    try{
      if(e.target.id==='formation-minutes'){
        const minutes=Number(f.get('minutes'));
        if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw Error('Minutes must be between 0 and 1440.');
        const row={user_id:a.user?.id,day:a.day,minutes,updated_at:new Date().toISOString()};
        await save('daily_prayer_sessions',row,'user_id,day');
        a.data.sessions=a.data.sessions.filter(s=>s.day!==a.day).concat(row);
      }else if(e.target.id==='formation-add-request'){
        const person=String(f.get('person')||'').trim(), request_text=String(f.get('request')||'').trim();
        if(!person||!request_text)throw Error('Enter a person and prayer request.');
        const row={id:uuid(),user_id:a.user?.id,person,request_text,status:'active',
          created_at:new Date().toISOString(),updated_at:new Date().toISOString(),answered_at:null};
        await save('daily_prayer_requests',row,'id');a.data.requests.push(row);
      }else{
        const items=f.getAll('item').map(v=>String(v).trim());
        if(items.some(v=>v.length>500))throw Error('Each gratitude item must be under 500 characters.');
        const week_start=startOfWeek(a.day);
        const row={user_id:a.user?.id,week_start,items,updated_at:new Date().toISOString()};
        await save('daily_gratitude',row,'user_id,week_start');
        a.data.gratitude=a.data.gratitude.filter(g=>g.week_start!==week_start).concat(row);
      }
      demoSave();render();status('Saved.');
    }catch(err){status('Not saved: '+err.message,true);}
  }
  async function change(e){
    const id=e.target.dataset.prayerCheck;if(!id)return;
    const a=active,day=a.day,row={user_id:a.user?.id,request_id:id,day};
    try{
      if(e.target.checked){
        if(a.user)await must(a.client.from('daily_prayer_checkins').upsert(row,{onConflict:'user_id,request_id,day'}));
        a.data.checkins.push(row);
      }else{
        if(a.user)await must(a.client.from('daily_prayer_checkins').delete().eq('user_id',a.user.id).eq('request_id',id).eq('day',day));
        a.data.checkins=a.data.checkins.filter(c=>!(c.request_id===id&&c.day===day));
      }
      demoSave();render();
    }catch(err){e.target.checked=!e.target.checked;status('Checkoff not saved: '+err.message,true);}
  }
  let draftTimer=null;
  function input(e){
    if(e.target.id!=='formation-notes-text')return;
    const a=active, text=e.target.value,backupKey='known-formation-draft:'+(a.user?.id||'guest')+':'+a.day;
    try{localStorage.setItem(backupKey,text);}catch{status('Device storage is full. Copy your notes to a safe place.',true);return;}
    const label=a.target.querySelector('#formation-notes-status');if(label)label.textContent='Saving...';
    clearTimeout(draftTimer);draftTimer=setTimeout(async()=>{
      if(active!==a||a.mode!=='notes')return;
      await storeNote(text);
      if(label?.isConnected)label.textContent='Last save attempted.';
    },1100);
  }
  async function mount(target,context){
    clearTimeout(draftTimer);ocrText='';ocrFile=null;
    if(!target)return;
    const a={target,client:context.client,user:context.user,day:context.day,
      compressImage:context.compressImage,mode:'prayer',data:empty(),recoveredDraft:false};
    active=a;
    target.innerHTML='<p class="subtle">Loading formation practices...</p>';
    try{await load();if(active!==a)return;render();}
    catch(e){if(active!==a)return;
      target.innerHTML='<section class="panel"><h2 class="section-title">Formation setup required</h2>'+
        '<p class="error">Your account could not load formation records: '+esc(e.message)+'</p>'+
        '<p class="note">Apply the new Supabase migration before using this feature. Existing data has not been modified.</p></section>';
      return;
    }
    target.addEventListener('click',click);
    target.addEventListener('submit',submit);
    target.addEventListener('change',change);
    target.addEventListener('input',input);
  }
  window.KNOWN_FORMATION={mount,startOfWeek};
})();
