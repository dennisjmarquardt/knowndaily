/* KNOWN Daily connected activity: Strava + Apple Health Shortcut bridge. */
(() => {
  'use strict';
  const C = window.KNOWN_DAILY_CONFIG || {};
  const endpoint = () => `${String(C.url || '').replace(/\/$/, '')}/functions/v1/known-activity-integrations`;
  let pendingAppleToken = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(value));
  const minutes = value => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(value))} min`;
  const hours = value => value === null || value === undefined ? '—' : `${(Number(value)/60).toFixed(1)} h`;
  const lastSync = value => value ? new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not synced yet';
  const duration = value => {
    const seconds = Number(value || 0), h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60);
    return h ? `${h}h ${m}m` : `${m} min`;
  };
  async function call(context, action, options = {}) {
    if (!context.client || !context.user) throw new Error('Sign in to KNOWN Daily first.');
    const {data,error} = await context.client.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error('Your KNOWN Daily session has expired. Please sign in again.');
    const url = new URL(endpoint());
    url.searchParams.set('mode', action);
    if (options.day) url.searchParams.set('day', options.day);
    const method = options.method || 'GET';
    const response = await fetch(url, {
      method,
      headers: {
        apikey: C.publishableKey,
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? {'Content-Type':'application/json'} : {})
      },
      ...(method === 'POST' ? {body:JSON.stringify(options.body || {})} : {})
    });
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok) throw new Error(result.error || `Activity service returned HTTP ${response.status}.`);
    return result;
  }
  function stat(label, value, unit, detail) {
    return `<div class="activity-stat"><div class="activity-stat-value">${esc(value)}</div><div class="activity-stat-label">${esc(label)}</div><div class="activity-stat-detail">${esc(unit || detail || '')}</div></div>`;
  }
  async function mountSummary(target, context) {
    if (!target) return;
    const manual = Number(context.manualMinutes || 0);
    if (!context.client || !context.user) {
      target.innerHTML = `
        <section class="activity-dash-card">
          <div class="activity-dash-heading"><div><div class="eyebrow">Movement & recovery</div><h2 class="section-title">Your activity</h2></div><button class="text-button" data-view="settings">Connect ↗</button></div>
          <div class="activity-dash-empty">Your activity minutes, workouts, steps, and sleep will appear here when you connect Apple Health or Strava.</div>
        </section>`;
      return;
    }
    target.innerHTML = `<section class="activity-dash-card"><p class="subtle">Loading your activity…</p></section>`;
    try {
      const result = await call(context,'summary',{day:context.day});
      if (!target.isConnected) return;
      const apple = result.summaries?.find(row=>row.source==='apple_health') || {};
      const strava = result.summaries?.find(row=>row.source==='strava') || {};
      const workouts = result.workouts || [];
      const appleMinutes = apple.exercise_minutes===null||apple.exercise_minutes===undefined ? null : Number(apple.exercise_minutes);
      const stravaMinutes = strava.workout_minutes===null||strava.workout_minutes===undefined ? (workouts.length?workouts.reduce((sum,w)=>sum+Number(w.duration_seconds||0)/60,0):null) : Number(strava.workout_minutes);
      // Prefer Apple Exercise Minutes for the daily total when available. Strava provides
      // the workout detail, but adding both would double-count the same exercise.
      const active = appleMinutes!==null ? appleMinutes : stravaMinutes!==null ? stravaMinutes : manual ? manual : null;
      const source = appleMinutes!==null ? 'Apple Health' : stravaMinutes!==null ? 'Strava workout time' : manual ? 'Your manual log' : 'No activity data yet';
      const goal = Number(context.activityGoal || 30);
      const goalMet = active!==null && active>=goal;
      const progress = active===null ? 0 : Math.min(100,Math.round(100*active/Math.max(goal,1)));
      const sleep = apple.sleep_minutes===null||apple.sleep_minutes===undefined ? '—' : hours(apple.sleep_minutes);
      const steps = apple.steps===null||apple.steps===undefined ? '—' : number(apple.steps);
      const activeLabel = active===null ? '—' : number(active);
      const workoutMarkup = workouts.length ? `
        <div class="activity-dash-workouts">
          <div class="activity-dash-workouts-title">Today's activity</div>
          ${workouts.slice(0,3).map(w=>`<div class="activity-dash-workout"><span><strong>${esc(w.name)}</strong><small>${esc(w.sport_type)}</small></span><b>${esc(duration(w.duration_seconds))}</b></div>`).join('')}
          ${workouts.length>3?`<p class="note">+${workouts.length-3} more workouts</p>`:''}
        </div>` : context.manualActivity ? `<div class="activity-dash-manual">${esc(context.manualActivity)} · ${number(manual)} min logged manually</div>` : '';
      target.innerHTML = `
        <section class="activity-dash-card">
          <div class="activity-dash-heading"><div><div class="eyebrow">Movement & recovery</div><h2 class="section-title">Your activity</h2></div><button class="text-button" data-view="activity">Details ↗</button></div>
          <div class="activity-dash-main">
            <div class="activity-dash-active"><strong>${activeLabel}</strong><span>active min</span><small>${esc(source)} · target ${number(goal)} min</small></div>
            <div class="activity-dash-progress-wrap"><div class="activity-dash-progress"><span style="width:${progress}%"></span></div><small>${active===null?'Connect a source to track activity':goalMet?'Goal reached · mark your habit complete when ready':`${number(Math.max(0,goal-active))} min to your goal`}</small></div>
          </div>
          <div class="activity-dash-metrics">
            <div><strong>${steps}</strong><small>steps</small></div>
            <div><strong>${sleep}</strong><small>sleep</small></div>
            <div><strong>${number(workouts.length || strava.workout_count || 0)}</strong><small>workouts</small></div>
          </div>
          ${workoutMarkup}
          ${appleMinutes===null && apple.steps==null && apple.sleep_minutes==null ? '<p class="activity-dash-footnote">Connect Apple Health to add exercise, steps, and sleep. Strava adds workout details. Imported minutes never auto-check your habit.</p>' : '<p class="activity-dash-footnote">Apple Health supplies exercise minutes, steps, and sleep. Strava adds workout details. No double-counting.</p>'}
        </section>`;
      const habitDetail = document.getElementById('activity-habit-detail');
      const habitStatus = document.getElementById('activity-habit-status');
      if (habitDetail) habitDetail.textContent = active===null ? `Goal ${goal} minutes` : `${number(active)} / ${number(goal)} minutes`;
      if (habitStatus) habitStatus.textContent = goalMet && !context.activityDone ? 'Goal reached · tap ✓ to complete' : workouts.length ? `${workouts.length} workout${workouts.length===1?'':'s'} recorded` : '';
    } catch (error) {
      if (target.isConnected) target.innerHTML = `
        <section class="activity-dash-card">
          <div class="activity-dash-heading"><div><div class="eyebrow">Movement & recovery</div><h2 class="section-title">Your activity</h2></div><button class="text-button" data-view="settings">Settings ↗</button></div>
          <p class="error">${esc(error.message)}</p><p class="activity-dash-footnote">Your habit checkmarks and manual activity log still work without a connection.</p>
        </section>`;
    }
  }
  function connectionCard(provider, connected, syncAt) {
    const name = provider==='strava'?'Strava':'Apple Health';
    return `<div class="activity-connection"><div class="activity-connection-copy"><strong>${name}</strong><span class="activity-connection-status ${connected?'is-connected':''}">${connected?'Connected':'Not connected'}</span><small>${connected?`Last sync: ${esc(lastSync(syncAt))}`:'No activity data is being imported yet.'}</small></div><div class="activity-connection-actions">${provider==='strava' ? (connected?`<button class="secondary" data-activity-action="strava-sync">Sync now</button><button class="danger" data-activity-action="strava-disconnect">Disconnect</button>`:`<button class="primary" data-activity-action="strava-connect">Connect Strava</button>`) : (connected?`<button class="secondary" data-activity-action="apple-health-token">Replace Shortcut key</button><button class="danger" data-activity-action="apple-health-disconnect">Disconnect</button>`:`<button class="primary" data-activity-action="apple-health-token">Create Shortcut key</button>`)}</div></div>`;
  }
  function settingsMarkup(connections) {
    const strava = connections.find(row=>row.provider==='strava') || {};
    const apple = connections.find(row=>row.provider==='apple_health') || {};
    return `
      <div class="activity-settings">
        <div class="eyebrow">Integrations</div><h2 class="section-title">Connected activity</h2>
        <p class="subtle">Connect once. KNOWN Daily will show active minutes, workout details, steps, and sleep on your daily dashboard. Imported activity never auto-checks a habit.</p>
        ${connectionCard('strava',strava.status==='connected',strava.last_sync_at)}
        ${connectionCard('apple_health',apple.status==='connected',apple.last_sync_at)}
        ${pendingAppleToken?`<div class="activity-token"><strong>Your new Apple Health Shortcut key</strong><p class="note">Copy this now. KNOWN Daily stores only a one-way hash, so this key cannot be shown again after you leave this screen.</p><input id="activity-shortcut-token" class="field" type="text" readonly value="${esc(pendingAppleToken)}" /><button class="secondary" data-activity-action="copy-apple-token">Copy key</button></div>`:''}
        <div class="activity-instructions"><strong>How the two connections work</strong>
          <ul><li><b>Strava</b> supplies your individual workouts, activity types, duration, distance, and elevation.</li><li><b>Apple Health</b> supplies daily exercise minutes, steps, and last-night sleep through an iPhone Shortcut.</li></ul>
          <p class="note">The Shortcut sends only the daily totals you choose. No GPS routes, heart-rate history, or full Health export is stored.</p>
          <a href="https://github.com/dennisjmarquardt/knowndaily/blob/main/README-ACTIVITY-INTEGRATION.md" target="_blank" rel="noopener noreferrer">Open the setup guide ↗</a>
        </div>
        <p class="note" id="activity-settings-status" aria-live="polite">Disconnecting a provider stops future imports. Previously imported summaries and workouts remain in your history.</p>
      </div>`;
  }
  async function renderSettings(target, context) {
    if (!target) return;
    if (!context.client || !context.user) {
      target.innerHTML = `<section class="panel activity-settings"><h2 class="section-title">Connected activity</h2><p class="subtle">Sign in to connect Apple Health and Strava.</p><button class="secondary" data-view="signin">Sign in</button></section>`;
      return;
    }
    target.innerHTML = `<section class="panel activity-settings"><p class="subtle">Checking connections…</p></section>`;
    try {
      const result = await call(context,'status');
      if (target.isConnected) target.innerHTML = `<section class="panel">${settingsMarkup(result.connections || [])}</section>`;
    } catch (error) {
      if (target.isConnected) target.innerHTML = `<section class="panel activity-settings"><h2 class="section-title">Connected activity</h2><p class="error">${esc(error.message)}</p></section>`;
    }
  }
  async function mountSettings(target, context) {
    if (!target) return;
    if (!target.dataset.activityBound) {
      target.dataset.activityBound = '1';
      target.addEventListener('click', async event => {
        const button = event.target.closest('[data-activity-action]');
        if (!button) return;
        const action = button.dataset.activityAction;
        const status = target.querySelector('#activity-settings-status');
        const setStatus = message => { if(status?.isConnected) status.textContent = message; };
        button.disabled = true;
        try {
          if (action === 'strava-connect') {
            const result = await call(context,'strava-start');
            if (!result.authorization_url) throw new Error('Strava did not return an authorization link.');
            window.location.assign(result.authorization_url);
            return;
          }
          if (action === 'strava-sync') {
            setStatus('Syncing your recent Strava activities…');
            const result = await call(context,'strava-sync',{method:'POST'});
            setStatus(`Sync complete: ${result.synced} activities processed.${result.more_available?' More older activities may remain; sync again shortly.':''}`);
            await renderSettings(target,context);
            context.onUpdate?.();
            return;
          }
          if (action === 'strava-disconnect') {
            if (!window.confirm('Disconnect Strava? Future imports will stop. Previously imported workouts will remain in KNOWN Daily.')) return;
            await call(context,'strava-disconnect',{method:'POST'});
            pendingAppleToken='';
            await renderSettings(target,context);
            context.onUpdate?.();
            return;
          }
          if (action === 'apple-health-token') {
            const result = await call(context,'apple-health-token',{method:'POST'});
            pendingAppleToken = result.token || '';
            await renderSettings(target,context);
            setStatus('Shortcut key created. Copy it now and add it to your iPhone Shortcut.');
            return;
          }
          if (action === 'apple-health-disconnect') {
            if (!window.confirm('Disconnect Apple Health? Your Shortcut key will stop working. Previously imported daily summaries will remain.')) return;
            await call(context,'apple-health-disconnect',{method:'POST'});
            pendingAppleToken='';
            await renderSettings(target,context);
            context.onUpdate?.();
            return;
          }
          if (action === 'copy-apple-token') {
            const input = target.querySelector('#activity-shortcut-token');
            if (!pendingAppleToken || !input) throw new Error('Generate a new Shortcut key first.');
            try { await navigator.clipboard.writeText(pendingAppleToken); setStatus('Shortcut key copied.'); }
            catch { input.focus(); input.select(); setStatus('Select and copy the highlighted key.'); }
          }
        } catch (error) {
          setStatus(error.message || 'The integration action could not be completed.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    }
    await renderSettings(target,context);
  }
  window.KNOWN_ACTIVITY = { mountSummary, mountSettings };
})();
