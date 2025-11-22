// sessions viewer and export utilities
(function(){
  const listEl = document.getElementById('sessionsList');
  const key = 'practicepal_sessions';

  function loadSessions(){
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  function render(){
    const sessions = loadSessions();
    listEl.innerHTML = '';
    if(sessions.length===0){ listEl.innerHTML = '<div class="text-gray-500">No sessions saved yet.</div>'; return; }
    sessions.slice().reverse().forEach(s=>{
      const el = document.createElement('div');
      el.className = 'p-3 border rounded bg-gray-50';
        const date = new Date(s.start).toLocaleString();
        const duration = s.durationSeconds != null ? `${s.durationSeconds}s` : '-';
        const goal = s.goalSeconds != null ? `${s.goalSeconds}s` : '-';
        const achieved = s.achievedGoal ? '✅' : '—';
        const matches = s.matches != null ? s.matches : 0;
        const micPeak = s.micPeak != null ? s.micPeak : 0;
        const micAvg = s.micAvg != null ? s.micAvg : 0;
        const view = s.viewStatus || '-';
        const light = s.lightingStatus || '-';
        el.innerHTML = `
          <div class="flex justify-between">
            <div class="font-semibold">${date}</div>
            <div class="text-sm text-gray-600">WPM: ${s.wpm} • Fillers: ${s.fillers}</div>
          </div>
          <div class="mt-2 text-sm text-gray-800">${escapeHtml(s.transcript || '')}</div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>Duration: ${duration} • Goal: ${goal} ${achieved}</div>
            <div>Matches: ${matches} • WPM: ${s.wpm}</div>
            <div>Mic peak: ${micPeak} • Mic avg: ${micAvg}</div>
            <div>View: ${view} • Light: ${light}</div>
          </div>
          <div class="mt-2 flex gap-2"><button data-id="${s.id}" class="exportJSON px-2 py-1 bg-indigo-600 text-white rounded text-sm">Export JSON</button><button data-id="${s.id}" class="exportCSV px-2 py-1 bg-gray-700 text-white rounded text-sm">Export CSV</button></div>
        `;
      listEl.appendChild(el);
    });

    // wire per-session export
    listEl.querySelectorAll('.exportJSON').forEach(b=> b.addEventListener('click', ()=>{ const id=b.dataset.id; exportOne(id,'json'); }));
    listEl.querySelectorAll('.exportCSV').forEach(b=> b.addEventListener('click', ()=>{ const id=b.dataset.id; exportOne(id,'csv'); }));
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  function download(filename, text){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text],{type:'text/plain'}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportOne(id, fmt){
    const sessions = loadSessions();
    const s = sessions.find(x=>x.id===id);
    if(!s){ alert('Session not found'); return; }
    if(fmt==='json') download(`session-${s.id}.json`, JSON.stringify(s, null, 2));
    if(fmt==='csv'){
      const headers = ['id','start','end','durationSeconds','goalSeconds','achievedGoal','wpm','fillers','matches','micPeak','micAvg','viewStatus','lightingStatus','preset','transcript'];
      const values = [s.id,s.start,s.end,s.durationSeconds||'',s.goalSeconds||'',s.achievedGoal?1:0,s.wpm||0,s.fillers||0,s.matches||0,s.micPeak||0,s.micAvg||0,s.viewStatus||'',s.lightingStatus||'',s.preset||'',(s.transcript||'').replace(/"/g,'""')];
      const csv = headers.join(',') + '\n' + values.map(v=>`"${v}"`).join(',');
      download(`session-${s.id}.csv`, csv);
    }
  }

  function exportAll(fmt){
    const sessions = loadSessions();
    if(fmt==='json') download('practicepal-sessions.json', JSON.stringify(sessions, null, 2));
    if(fmt==='csv'){
      const headers = ['id','start','end','durationSeconds','goalSeconds','achievedGoal','wpm','fillers','matches','micPeak','micAvg','viewStatus','lightingStatus','preset','transcript'];
      const rows = [headers.join(',')];
      sessions.forEach(s=>{
        const values = [s.id,s.start,s.end,s.durationSeconds||'',s.goalSeconds||'',s.achievedGoal?1:0,s.wpm||0,s.fillers||0,s.matches||0,s.micPeak||0,s.micAvg||0,s.viewStatus||'',s.lightingStatus||'',s.preset||'',(s.transcript||'').replace(/"/g,'""')];
        rows.push(values.map(v=>`"${v}"`).join(','));
      });
      download('practicepal-sessions.csv', rows.join('\n'));
    }
  }

  function clearAll(){ if(confirm('Clear all saved sessions?')){ localStorage.removeItem(key); render(); } }

  document.getElementById('exportAllJson').addEventListener('click', ()=> exportAll('json'));
  document.getElementById('exportAllCsv').addEventListener('click', ()=> exportAll('csv'));
  document.getElementById('clearAll').addEventListener('click', ()=> clearAll());

  render();

})();
