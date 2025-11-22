// PracticePal - lightweight client-side demo behavior
(function(){
  const camera = document.getElementById('camera');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveBtn = document.getElementById('saveBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const transcriptEl = document.getElementById('transcript');
  const wpmEl = document.getElementById('wpm');
  const fillersEl = document.getElementById('fillers');
  const matchesEl = document.getElementById('matches');
  const notesEl = document.getElementById('notes');
  const micStatusEl = document.getElementById('micStatus');
  const preset = document.getElementById('preset');
  const goalTime = document.getElementById('goalTime');
  const timerDisplay = document.getElementById('timerDisplay');
  const goalDisplay = document.getElementById('goalDisplay');

  const PRESETS = {
    intro: `Hi, I'm Alex. I help teams ship delightful products faster by focusing on customer outcomes and pragmatic engineering choices.`,
    project: `Our product solves X by providing a simpler workflow that reduces time-to-value, improving retention and lowering support costs.`,
    interview: `Situation: I worked on a cross-functional team. Task: We needed to improve throughput. Action: I introduced small experiments. Result: Throughput improved by 20%.`,
    speech: `We must act now. Together we can create a future where technology empowers everyone, not just the few.`
  };

  notesEl.textContent = PRESETS[preset.value];
  preset.addEventListener('change', ()=>{ notesEl.textContent = PRESETS[preset.value]; updateMatches(); });

  // state
  let mediaStream = null;
  let recognition = null;
  let recognizing = false;
  let transcript = '';
  let sessionStart = null;
  let fillers = 0;
  let sessionRunning = false;
  let timerInterval = null;
  let sessionGoalSeconds = 60;
  let remainingSeconds = 0;
  let audioMuted = false;
  // mic monitor state
  let micStream = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let micLevel = 0; // 0..1
  // mic statistics for sessions
  let micPeak = 0;
  let micSum = 0;
  let micSamples = 0;
  // MediaPipe shared instances
  let mpHands = null;
  let mpFaceDetection = null;
  let sharedMpCamera = null;

  const fillerWords = ['um','uh','like','you know','so'];

  async function startCamera(){
    try{
      mediaStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      camera.srcObject = mediaStream;
      // attach mic monitor to the same stream if available
      attachMicStream(mediaStream);
    }catch(e){
      console.warn('Camera access denied or unavailable',e);
    }
  }

  function stopCamera(){
    if(mediaStream){
      mediaStream.getTracks().forEach(t=>t.stop());
      camera.srcObject = null;
      mediaStream = null;
    }
  }

  function setupSpeech(){
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){ setMicStatus('Speech API not available'); return null; }
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = (navigator.language || 'en-US');
    console.debug('SpeechRecognition created, lang=' + r.lang);
    r.onresult = (ev)=>{
      let interim = '';
      for(let i=ev.resultIndex;i<ev.results.length;i++){
        const res = ev.results[i];
        if(res.isFinal){
          const text = res[0].transcript.trim();
          if(text){
            transcript += (transcript? ' ' : '') + text;
            // final result -> run command detection on the fragment
            try{ handleCommand(text); }catch(e){ console.warn('handleCommand error',e); }
            console.debug('Speech final:', text);
          }
        } else {
          interim += res[0].transcript;
          console.debug('Speech interim:', res[0].transcript);
        }
      }
      renderTranscript(transcript + (interim ? ' ' + interim : ''));
      updateMetrics();
    };
    r.onstart = ()=>{ setMicStatus('Listening'); recognizing = true; };
    r.onspeechstart = ()=>{ setMicStatus('Speech detected'); };
    r.onspeechend = ()=>{ setMicStatus('Idle'); };
    r.onend = ()=>{
      // if session is still running and not muted, try to restart
      setMicStatus('Idle');
      recognizing = false;
      console.debug('Speech recognition ended');
      if(sessionRunning && !audioMuted){
        console.debug('Attempting recognition restart');
        try{ r.start(); console.debug('recognition restarted'); }catch(e){ console.warn('recognition restart failed', e); }
      }
    };
    r.onerror = (e)=>{ console.warn('Speech error', e); setMicStatus('Speech error'); console.debug('recognition error:', e && (e.error || e.message)); };
    return r;
  }

  // no on-page debug log - use console.debug instead

  function setMicStatus(text, level){
    if(!micStatusEl) return;
    if(typeof level === 'number'){
      const pct = Math.round(level * 100);
      micStatusEl.textContent = `${text} (${pct}%)`;
    } else {
      micStatusEl.textContent = text;
    }
  }

  function attachMicStream(stream){
    try{
      if(!stream) return;
      micStream = stream;
      // reuse existing AudioContext if present
      if(!audioContext){
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const source = audioContext.createMediaStreamSource(micStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      // start visual loop
      monitorMicLevel();
      setMicStatus('Available');
    }catch(e){ console.warn('attachMicStream error', e); setMicStatus('Mic unavailable'); }
  }

  function monitorMicLevel(){
    if(!analyser || !dataArray) return;
    try{
      analyser.getByteTimeDomainData(dataArray);
      // compute RMS-like value
      let sum = 0;
      for(let i=0;i<dataArray.length;i++){
        const v = (dataArray[i] - 128) / 128; sum += v*v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      micLevel = Math.min(1, rms * 5); // scale for visibility
      // accumulate session mic stats when running
      if(sessionRunning){ micSum += micLevel; micSamples += 1; if(micLevel > micPeak) micPeak = micLevel; }
      // if muted, show muted
      if(audioMuted){ setMicStatus('Muted', micLevel); }
      else { setMicStatus('Listening', micLevel); }
    }catch(e){ /* ignore while stream initializing */ }
    requestAnimationFrame(monitorMicLevel);
  }

  function renderTranscript(text){
    transcriptEl.textContent = text || '';
  }

  function countFillers(text){
    const lower = text.toLowerCase();
    let c = 0;
    fillerWords.forEach(w=>{
      const re = new RegExp('\\b'+w.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+'\\b','g');
      const m = lower.match(re);
      if(m) c += m.length;
    });
    return c;
  }

  function wordsCount(text){
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function updateMetrics(){
    const now = Date.now();
    const seconds = sessionStart ? ((now - sessionStart)/1000) : 0;
    const wc = wordsCount(transcript);
    const wpm = seconds>0 ? Math.round((wc / seconds) * 60) : 0;
    fillers = countFillers(transcript);
    wpmEl.textContent = wpm;
    fillersEl.textContent = fillers;
    updateMatches();
  }

  function updateMatches(){
    const notesText = notesEl.textContent || '';
    const noteWords = new Set(notesText.toLowerCase().split(/\W+/).filter(Boolean));
    const speechWords = (transcript || '').toLowerCase().split(/\W+/).filter(Boolean);
    let matchCount = 0;
    // highlight notes text: simple rebuild
    const parts = notesText.split(/(\W+)/).map(p=>{
      if(!p.trim()) return p;
      if(noteWords.has(p.toLowerCase()) && speechWords.includes(p.toLowerCase())){ matchCount++; return `<span class=\"match\">${escapeHtml(p)}</span>`; }
      return escapeHtml(p);
    });
    notesEl.innerHTML = parts.join('');
    matchesEl.textContent = matchCount;
  }

  function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  function startSession(){
    if(sessionRunning) return;
    if(!mediaStream) startCamera();
    if(!recognition) recognition = setupSpeech();
    if(!audioMuted && recognition){ try{ recognition.start(); }catch(e){} recognizing = true; }
    // reset mic stats for this session
    micPeak = 0; micSum = 0; micSamples = 0;
    sessionStart = Date.now();
    transcript = '';
    renderTranscript('');
    // start timer from goal input
    const g = parseInt(goalTime.value, 10) || 60; sessionGoalSeconds = g; goalDisplay.textContent = `${g}s`;
    remainingSeconds = sessionGoalSeconds;
    updateTimerDisplay();
    timerInterval = setInterval(()=>{
      remainingSeconds -= 1;
      updateTimerDisplay();
      if(remainingSeconds <= 0){
        clearInterval(timerInterval); timerInterval = null;
        // stop session and prompt to save
        stopSession();
        setTimeout(()=>{
          if(confirm('Goal reached. Save session?')) saveSession();
        }, 200);
      }
    }, 1000);
    sessionRunning = true;
    updateMetrics();
  }

  function updateTimerDisplay(){
    if(!timerDisplay) return;
    const s = Math.max(0, remainingSeconds || 0);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    timerDisplay.textContent = `${mm}:${ss}`;
  }

  function stopSession(){
    if(recognition && recognizing){ try{ recognition.stop(); }catch(e){} recognizing = false; }
    // stop timer
    if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
    remainingSeconds = 0; updateTimerDisplay();
    // mark session not running but keep sessionStart for save use
    sessionRunning = false;
    // leave camera running; user can stop camera explicitly if desired
  }

  function toggleAudio(){
    // toggle microphone audio tracks (mute/unmute)
    audioMuted = !audioMuted;
    toggleAudioBtn.textContent = audioMuted ? 'Unmute' : 'Mute';
    if(mediaStream){
      mediaStream.getAudioTracks().forEach(t=>{ t.enabled = !audioMuted; });
    }
    // also pause/resume speech recognition accordingly
    if(audioMuted){
      if(recognition && recognizing){ try{ recognition.stop(); }catch(e){} recognizing = false; }
    } else {
      if(recognition && sessionRunning && !recognizing){ try{ recognition.start(); recognizing = true; }catch(e){} }
    }
  }

  function saveSession(){
    const endTs = Date.now();
    const durationSec = sessionStart ? Math.round((endTs - sessionStart)/1000) : 0;
    const matches = parseInt(matchesEl.textContent, 10) || 0;
    const micAvg = micSamples ? (micSum / micSamples) : micPeak;
    const viewStatusEl = document.getElementById('viewStatus');
    const lightStatusEl = document.getElementById('lightingStatus');
    const session = {
      id: 's_' + Date.now(),
      start: sessionStart || Date.now(),
      end: endTs,
      durationSeconds: durationSec,
      goalSeconds: sessionGoalSeconds || 0,
      achievedGoal: durationSec >= (sessionGoalSeconds || 0),
      transcript: transcript.trim(),
      wpm: parseInt(wpmEl.textContent,10) || 0,
      fillers: fillers,
      matches: matches,
      micPeak: Math.round(micPeak * 100) / 100,
      micAvg: Math.round((micAvg || 0) * 100) / 100,
      viewStatus: viewStatusEl ? viewStatusEl.textContent : null,
      lightingStatus: lightStatusEl ? lightStatusEl.textContent : null,
      preset: preset.value,
      notes: notesEl.textContent
    };
    const key = 'practicepal_sessions';
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    cur.push(session);
    localStorage.setItem(key, JSON.stringify(cur));
    alert('Session saved (localStorage)');
  }

  // simple voice command handling for a few commands
  function handleCommand(text){
    const t = text.toLowerCase();
    if(t.includes('start')) startSession();
    if(t.includes('stop')) stopSession();
    if(t.includes('mute')) { if(recognizing){ stopSession(); } }
    if(t.includes('unmute')) { if(!recognizing){ if(!recognition) recognition = setupSpeech(); recognition.start(); } }
    if(t.includes('scroll up')) notesEl.scrollBy({top:-80,behavior:'smooth'});
    if(t.includes('scroll down')) notesEl.scrollBy({top:80,behavior:'smooth'});
  }

  // wire buttons
  startBtn.addEventListener('click', ()=>{ startSession(); });
  stopBtn.addEventListener('click', ()=>{
    stopSession();
    // ask user if they'd like to save
    setTimeout(()=>{
      if(confirm('Stop session. Save session?')) saveSession();
    }, 150);
  });
  saveBtn.addEventListener('click', ()=>{ saveSession(); });
  toggleAudioBtn.addEventListener('click', ()=>{ toggleAudio(); });

  // transcription is started automatically when `startSession()` is called.

  // if speech available, listen for commands on interim results as well
  // We'll wrap recognition.onresult to also detect simple commands
  const originalSetup = setupSpeech;

  // initialize camera on load (user will still be prompted by browser when starting)
  startCamera().catch(()=>{});
  // if camera access fails or user denies camera, try to request audio-only to get mic status
  (async function tryAudioOnlyFallback(){
    try{
      if(!micStream){
        const s = await navigator.mediaDevices.getUserMedia({audio:true});
        attachMicStream(s);
      }
    }catch(e){
      console.warn('Audio-only mic fallback failed or denied', e);
      // leave mic status as-is
    }
  })();

  // small interval to update metrics while session running
  setInterval(()=>{ if(sessionStart) updateMetrics(); }, 1500);

  // expose for debugging
  window.PracticePal = { startSession, stopSession, saveSession };

  // Start a single shared MediaPipe Camera that forwards frames to both Hands and FaceDetection
  async function startSharedMediaPipeCamera(){
    if(sharedMpCamera) return;
    if(typeof Camera === 'undefined'){
      console.warn('MediaPipe Camera helper not available; cannot start shared camera');
      return;
    }
    const videoEl = document.getElementById('camera');
    if(!videoEl) return;
    try{
      sharedMpCamera = new Camera(videoEl, {
        onFrame: async () => {
          // forward frames to whichever models are ready
          try{ if(mpHands) await mpHands.send({image: videoEl}); }catch(e){ /* ignore per-frame errors */ }
          try{ if(mpFaceDetection) await mpFaceDetection.send({image: videoEl}); }catch(e){ /* ignore per-frame errors */ }
        },
        width: 640,
        height: 480
      });
      await sharedMpCamera.start();
      console.log('Shared MediaPipe Camera started');
    }catch(e){ console.warn('Failed to start shared MediaPipe Camera', e); }
  }

  // try to start after a brief delay so both modules have a chance to initialize
  setTimeout(()=>{ startSharedMediaPipeCamera(); }, 250);

  // --- MediaPipe Hands integration for simple gesture controls ---
  (function integrateMediaPipe(){
    // require the global classes from the CDN scripts added in index.html
    if(!(window.Hands && window.Camera && window.drawConnectors && window.drawLandmarks && window.HAND_CONNECTIONS)){
      console.warn('MediaPipe Hands or drawing utils not available; skipping gesture integration.');
      return;
    }

    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });

    const overlay = document.getElementById('overlay');
    const overlayCtx = overlay && overlay.getContext ? overlay.getContext('2d') : null;
    const videoEl = document.getElementById('camera');
      const gestureLabelEl = document.getElementById('gestureLabel');
      let gestureClearTimeout = null;

      function setGestureLabel(name){
        if(!gestureLabelEl) return;
        if(!name) { gestureLabelEl.textContent = '' ; return; }
        gestureLabelEl.textContent = name;
        if(gestureClearTimeout) clearTimeout(gestureClearTimeout);
        gestureClearTimeout = setTimeout(()=>{ if(gestureLabelEl) gestureLabelEl.textContent = ''; gestureClearTimeout = null; }, 1600);
      }

    function resizeOverlay(){
      if(!overlay || !videoEl) return;
      overlay.width = videoEl.clientWidth || videoEl.videoWidth || 640;
      overlay.height = videoEl.clientHeight || videoEl.videoHeight || 480;
    }
    // keep overlay size roughly in sync
    setInterval(resizeOverlay, 500);

    let lastGestureTime = 0;
    let lastIndexY = null;
    // gesture hold state
    let gestureCandidate = null;
    let gestureCandidateStart = 0;
    let gestureCooldownUntil = 0;
    let pointMode = false; // when true, pointing allows scrolling while held

    function onResults(results){
      if(!overlayCtx) return;
      resizeOverlay();
      overlayCtx.clearRect(0,0,overlay.width, overlay.height);
      if(results.multiHandLandmarks && results.multiHandLandmarks.length){
        for(const landmarks of results.multiHandLandmarks){
          drawConnectors(overlayCtx, landmarks, HAND_CONNECTIONS, {color:'#00FF88', lineWidth:2});
          drawLandmarks(overlayCtx, landmarks, {color:'#ff0066', lineWidth:1});
        }
        const lm = results.multiHandLandmarks[0];
        detectGesturesFromLandmarks(lm);
      }
    }

    function detectGesturesFromLandmarks(lm){
      // Landmark indices: 0 wrist, 4 thumb tip, 8 index tip, 12 middle tip, 16 ring tip, 20 pinky tip
      const now = Date.now();
      function extended(tipIdx, pipIdx){
        if(!lm[tipIdx] || !lm[pipIdx]) return false;
        return lm[tipIdx].y < lm[pipIdx].y - 0.02; // threshold
      }
      const extThumb = extended(4,2) || extended(4,3);
      const extIndex = extended(8,6);
      const extMiddle = extended(12,10);
      const extRing = extended(16,14);
      const extPinky = extended(20,18);
      const extCount = [extThumb, extIndex, extMiddle, extRing, extPinky].filter(Boolean).length;

      // Determine current detected gesture name (simple priority)
      let detected = null;
      if(extCount >= 4) detected = 'open_palm';
      else if(extCount <= 1) detected = 'fist';
      else if(extThumb && !extIndex && !extMiddle && !extRing && !extPinky) detected = 'thumbs_up';
      else if(extIndex && !extMiddle && !extRing && !extPinky) detected = 'point';

      // If candidate changed, start timing
      if(detected !== gestureCandidate){
        gestureCandidate = detected;
        gestureCandidateStart = detected ? now : 0;
        // reset point mode when losing point
        if(detected !== 'point'){ pointMode = false; lastIndexY = null; }
      }

      // If we have a candidate and it's been held long enough and cooldown passed, trigger action
      const HOLD_MS = 3000;
      const COOLDOWN_MS = 1500;
      if(detected && gestureCandidateStart && (now - gestureCandidateStart >= HOLD_MS) && now > gestureCooldownUntil){
        // perform action once
        gestureCooldownUntil = now + COOLDOWN_MS;
        lastGestureTime = now;
        if(detected === 'open_palm'){
          setGestureLabel('Open palm');
          startSession();
        } else if(detected === 'fist'){
          setGestureLabel('Fist');
          stopSession();
        } else if(detected === 'thumbs_up'){
          setGestureLabel('Thumbs up');
          saveSession();
        } else if(detected === 'point'){
          // activate point mode for scrolling
          pointMode = true;
          setGestureLabel('Point (scroll)');
        }
      }

      // If pointMode is active and index present, handle vertical scroll while held
      if(pointMode && extIndex){
        const idxY = lm[8].y;
        if(lastIndexY !== null){
          const dy = lastIndexY - idxY; // positive => moved up
          const SCROLL_THRESHOLD = 0.01;
          const SCROLL_COOLDOWN = 120; // ms
          if(Math.abs(dy) > SCROLL_THRESHOLD && now - lastGestureTime > SCROLL_COOLDOWN){
            if(dy > 0) notesEl.scrollBy({top:-120, behavior:'smooth'});
            else notesEl.scrollBy({top:120, behavior:'smooth'});
            lastGestureTime = now;
          }
        }
        lastIndexY = idxY;
      } else {
        // clear lastIndexY when not pointing
        lastIndexY = null;
      }
    }

    mpHands = hands;
    mpHands.onResults(onResults);
    console.log('MediaPipe Hands initialized (gesture controls)');
  })();

  // --- MediaPipe FaceDetection + lighting sampling for View & Lighting status ---
  (function addViewLightingStatus(){
    const viewEl = document.getElementById('viewStatus');
    const lightEl = document.getElementById('lightingStatus');
    const videoEl = document.getElementById('camera');

    // Offscreen canvas for brightness sampling
    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext && sampleCanvas.getContext('2d');

    // thresholds for lighting (0-255 range)
    const LIGHT_GOOD = 150;
    const LIGHT_OK = 90;

    function setViewStatus(text){ if(viewEl) viewEl.textContent = text; }
    function setLightStatus(text){ if(lightEl) lightEl.textContent = text; }

    // start with Poor by default
    setViewStatus('Poor');
    setLightStatus('Poor');

    // brightness sampling function
    function sampleLighting(){
      if(!sampleCtx || !videoEl || videoEl.readyState < 2) return null;
      const w = Math.max(32, Math.floor(videoEl.videoWidth * 0.3));
      const h = Math.max(32, Math.floor(videoEl.videoHeight * 0.3));
      sampleCanvas.width = w; sampleCanvas.height = h;
      // draw central region
      const sx = Math.max(0, Math.floor((videoEl.videoWidth - w)/2));
      const sy = Math.max(0, Math.floor((videoEl.videoHeight - h)/2));
      try{
        sampleCtx.drawImage(videoEl, sx, sy, w, h, 0, 0, w, h);
      }catch(e){ return null; }
      const img = sampleCtx.getImageData(0,0,w,h).data;
      let sum = 0; let count = 0;
      for(let i=0;i<img.length;i+=4){ const r=img[i], g=img[i+1], b=img[i+2]; const lum = 0.2126*r + 0.7152*g + 0.0722*b; sum += lum; count++; }
      const avg = count? sum/count : 0;
      return avg; // 0-255
    }

    // Periodically update lighting (fast) and fall back for view if no face detector
    setInterval(()=>{
      const avg = sampleLighting();
      if(avg !== null){
        if(avg >= LIGHT_GOOD) setLightStatus('Good');
        else if(avg >= LIGHT_OK) setLightStatus('OK');
        else setLightStatus('Poor');
      }
    }, 800);

    // MediaPipe FaceDetection integration
    let FaceDetectionCtor = window.FaceDetection || (window.faceDetection && window.faceDetection.FaceDetection) || null;
    if(!FaceDetectionCtor){ console.warn('MediaPipe FaceDetection not available. Ensure face_detection.js is loaded.'); return; }

    const faceDetection = new FaceDetectionCtor({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`});
    faceDetection.setOptions({minDetectionConfidence:0.5, model:'short'});

    const overlay = document.getElementById('overlay');
    const overlayCtx = overlay && overlay.getContext ? overlay.getContext('2d') : null;

    mpFaceDetection = faceDetection;
    mpFaceDetection.onResults((results)=>{
      // clear overlay
      if(overlayCtx && overlay){ overlayCtx.clearRect(0,0,overlay.width, overlay.height); }
      if(results.detections && results.detections.length){
        const d = results.detections[0];
        // try different bbox shapes
        const bbox = d.boundingBox || (d.locationData && d.locationData.relativeBoundingBox) || null;
        if(bbox){
          // bounding values may be normalized (0-1)
          const bw = bbox.width || bbox.w || 0;
          const bh = bbox.height || bbox.h || 0;
          const area = bw * bh;
          if(area > 0.12) setViewStatus('Good');
          else if(area > 0.03) setViewStatus('OK');
          else setViewStatus('Poor');

          // draw rectangle if we have overlay size
          if(overlayCtx && overlay && typeof bw === 'number' && bw > 0){
            // compute pixel coords. FaceDetection's bbox may be centered or min coords; try multiple keys
            const vw = overlay.width, vh = overlay.height;
            let x = (bbox.xCenter !== undefined) ? (bbox.xCenter - bw/2) : (bbox.xMin !== undefined ? bbox.xMin : (bbox.x || 0));
            let y = (bbox.yCenter !== undefined) ? (bbox.yCenter - bh/2) : (bbox.yMin !== undefined ? bbox.yMin : (bbox.y || 0));
            // convert normalized to pixels if values <=1
            if(x <= 1 && y <= 1 && bw <= 1 && bh <= 1){ x *= vw; y *= vh; }
            const px = x; const py = y; const pw = bw * (bw <=1 ? vw : 1); const ph = bh * (bh <=1 ? vh : 1);
            overlayCtx.strokeStyle = '#00FF88'; overlayCtx.lineWidth = 2; overlayCtx.strokeRect(px, py, pw, ph);
          }
        } else {
          setViewStatus('OK');
        }
      } else {
        // no face detected -> live show Poor
        setViewStatus('Poor');
      }
    });

    console.log('MediaPipe FaceDetection initialized');

  })();

})();
