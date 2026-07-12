/**
 * StageTimer PRO - Core Interactive Application Logic
 * Implements a high-precision stage countdown timer with dynamic color changes,
 * custom Web Audio chimes, local storage memory, and scaling stage display.
 */

// --- STATE MANAGEMENT ---
let timerState = {
  initialDurationSeconds: 1800, // Default 30 mins
  remainingSeconds: 1800,
  isTicking: false,
  isPaused: false,
  endTime: null,               // Absolute timestamp when countdown should end
  pauseTimeDelta: null,        // Stores remaining time when paused
  alertThreshold: 0.35,        // 35% Alert warning threshold
  isSoundEnabled: true,
  isSecondsEnabled: true,
  isHourHidden: false,
  isCurrentTimeEnabled: false,
  overtimeMode: false,
  playedAlertChime: false,     // Prevents repeating the threshold sound
  playedZeroChime: false,      // Prevents repeating the end sound
  activePresetSeconds: 1800
};

// --- PRESENTS & THEMES ---
const THEMES = {
  'neon-forest': {
    safe: '#10b981',  // Lime/Emerald Green
    alert: '#f43f5e', // Neon Red/Pink
    name: 'Emerald & Rose'
  },
  'ocean-breeze': {
    safe: '#06b6d4',  // Vibrant Cyan
    alert: '#f97316', // Neon Orange
    name: 'Cyan & Orange'
  },
  'sunny-warning': {
    safe: '#f59e0b',  // Rich Amber
    alert: '#ef4444', // Classic Stage Red
    name: 'Amber & Vivid Red'
  },
  'classic-monochrome': {
    safe: '#f4f4f5',  // Off White
    alert: '#f59e0b', // Rich Amber
    name: 'White & Amber'
  }
};

let currentTheme = 'neon-forest';
let customColors = {
  safe: '#10b981',
  alert: '#f43f5e'
};

// --- DYNAMIC SESSION PRESETS ---
let presets = [
  { id: 'preset-sermon', name: 'Sermon', seconds: 2400, isDefault: true },
  { id: 'preset-worship', name: 'Worship Sets', seconds: 900, isDefault: true },
  { id: 'preset-announcements', name: 'Announcements', seconds: 300, isDefault: true },
  { id: 'preset-test', name: 'Test Alert', seconds: 10, isDefault: true, isTest: true }
];

function renderPresets() {
  const grid = document.getElementById('presets-grid');
  if (!grid) return;
  grid.innerHTML = '';

  presets.forEach((preset, index) => {
    const hrs = Math.floor(preset.seconds / 3600);
    const mins = Math.floor((preset.seconds % 3600) / 60);
    const secs = preset.seconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    let timeStr = "";
    if (hrs > 0) {
      timeStr = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    } else {
      timeStr = `${pad(mins)}:${pad(secs)}`;
    }

    const btn = document.createElement('button');
    btn.className = `preset-glow flex flex-col items-start p-3 rounded-xl border ${preset.isTest ? 'border-zinc-800 hover:border-red-500/40' : 'border-zinc-800 hover:border-emerald-500/40'} bg-zinc-900/40 text-left relative group w-full transition-all duration-300 cursor-pointer`;
    
    let labelHTML = "";
    if (preset.isTest) {
      labelHTML = `
        <span class="text-xs text-red-400 font-semibold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse"></span> ${preset.name}
        </span>
      `;
    } else {
      labelHTML = `<span class="text-xs text-zinc-400 font-medium truncate w-full pr-4">${preset.name}</span>`;
    }

    btn.innerHTML = `
      ${labelHTML}
      <span class="text-lg font-semibold text-white mt-1 font-digital">${timeStr}</span>
    `;

    // Only show delete button for non-default custom presets
    if (!preset.isDefault) {
      const deleteBtn = document.createElement('span');
      deleteBtn.className = "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-zinc-500 hover:text-red-400 cursor-pointer text-xs font-bold leading-none p-1 rounded hover:bg-zinc-800/80 flex items-center justify-center h-5 w-5";
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomPreset(index);
      });
      btn.appendChild(deleteBtn);
    }

    btn.addEventListener('click', () => {
      loadPreset(preset.seconds, preset.name, preset.isTest);
    });

    grid.appendChild(btn);
  });
}

function deleteCustomPreset(index) {
  const presetToDelete = presets[index];
  if (presetToDelete.isDefault) return;

  presets.splice(index, 1);
  const customPresets = presets.filter(p => !p.isDefault);
  localStorage.setItem('stagetimer_presets', JSON.stringify(customPresets));
  renderPresets();
}


// --- WEB AUDIO API SYNTHESIZER ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

/**
 * Synthesizes a premium, resonant church/bell chime.
 * Uses additive synthesis to combine harmonics and applies a natural exponential decay.
 */
function playBellChime(pitchType = 'alert') {
  if (!timerState.isSoundEnabled) return;
  
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // Fundamental frequencies: D5 (587.33 Hz) for alert, G4 (392.00 Hz) for completion/overtime
    const fundamental = pitchType === 'alert' ? 587.33 : 392.00;
    
    // Define bell strike harmonics (partial ratios & relative gains)
    // Bells have strong octaves, a minor third, and a perfect fifth
    const partials = [
      { freqRatio: 0.5, gainRatio: 0.15, decay: 2.0 },  // Hum tone (sub-octave)
      { freqRatio: 1.0, gainRatio: 0.35, decay: 2.5 },  // Prime / Fundamental
      { freqRatio: 1.2, gainRatio: 0.25, decay: 1.8 },  // Minor third (gives bell character)
      { freqRatio: 1.5, gainRatio: 0.15, decay: 1.5 },  // Fifth
      { freqRatio: 2.0, gainRatio: 0.20, decay: 1.0 },  // Nominal (octave)
      { freqRatio: 3.0, gainRatio: 0.08, decay: 0.6 }   // Supernominal
    ];

    // Master Volume control
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    
    // Sharp strike attack and long ringing sustain
    if (pitchType === 'alert') {
      masterGain.gain.linearRampToValueAtTime(0.4, now + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    } else {
      // Double strike effect for timer zero!
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.42);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    }

    masterGain.connect(audioCtx.destination);

    partials.forEach(p => {
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      
      // Use sine for clean tone with high harmonics
      osc.type = 'sine';
      osc.frequency.value = fundamental * p.freqRatio;
      
      oscGain.gain.setValueAtTime(p.gainRatio, now);
      // Decay each harmonic at its own rate
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + Math.max(3.0, p.decay));
    });
  } catch (err) {
    console.error('Audio synthesis failed:', err);
  }
}

// --- DOM ELEMENTS ---
const elHeader = document.getElementById('app-header');
const elControls = document.getElementById('app-controls');
const elViewport = document.getElementById('timer-viewport');
const elStatusBadge = document.getElementById('status-badge');
const elStatusText = document.getElementById('status-text');
const elDisplayLabel = document.getElementById('display-label');
const elDisplay = document.getElementById('countdown-display');
const elCurrentTimeContainer = document.getElementById('current-time-container');
const elCurrentTimeDisplay = document.getElementById('current-time-display');
const elProgressBar = document.getElementById('dynamic-progress-bar');
const elExitHint = document.getElementById('exit-stage-hint');

// Playback buttons
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnClear = document.getElementById('btn-clear');

// Inputs
const inputH = document.getElementById('input-h');
const inputM = document.getElementById('input-m');
const inputS = document.getElementById('input-s');

// Settings Elements
const themeSelect = document.getElementById('theme-select');
const colorSafeInput = document.getElementById('color-safe-input');
const colorAlertInput = document.getElementById('color-alert-input');
const colorSafeLbl = document.getElementById('color-safe-lbl');
const colorAlertLbl = document.getElementById('color-alert-lbl');
const customColorsContainer = document.getElementById('custom-colors-container');
const thresholdInput = document.getElementById('threshold-input');
const thresholdVal = document.getElementById('threshold-val');
const toggleSound = document.getElementById('toggle-sound');
const toggleHours = document.getElementById('toggle-hours');
const toggleCurrentTime = document.getElementById('toggle-current-time');
const toggleSeconds = document.getElementById('toggle-seconds');

// Viewport buttons
const btnToggleStage = document.getElementById('btn-toggle-stage');
const btnFullscreen = document.getElementById('btn-fullscreen');
const stageIconStage = document.getElementById('stage-icon-stage');
const stageIconExit = document.getElementById('stage-icon-exit');

// Add/Subtract Quick-add buttons
const add10m = document.getElementById('add-10m');
const add1m = document.getElementById('add-1m');
const sub1m = document.getElementById('sub-1m');
const sub10m = document.getElementById('sub-10m');

// --- TIMER PRECISION LOOP ENGINE ---
let timerInterval = null;

function tick() {
  if (!timerState.isTicking) return;

  const now = Date.now();
  let timeDifference = 0;

  if (timerState.overtimeMode) {
    // Ticking positive in overtime
    timeDifference = Math.floor((now - timerState.endTime) / 1000);
    timerState.remainingSeconds = -timeDifference;
  } else {
    // Ticking down to zero
    timeDifference = Math.ceil((timerState.endTime - now) / 1000);
    
    if (timeDifference <= 0) {
      // Transition exactly to 0, then enter overtime
      timerState.remainingSeconds = 0;
      timerState.overtimeMode = true;
      timerState.endTime = now; // Overtime start reference timestamp
      
      // Trigger Completion Audio Chime
      if (!timerState.playedZeroChime) {
        playBellChime('zero');
        timerState.playedZeroChime = true;
      }
    } else {
      timerState.remainingSeconds = timeDifference;
    }
  }

  updateDisplay();
}

function startTimer() {
  if (timerState.isTicking) return;

  // Initialize Audio Synth context
  initAudio();

  // If starting clean or after clear, capture inputs
  if (!timerState.isPaused && !timerState.overtimeMode) {
    const totalInputSecs = getSecondsFromInputs();
    if (totalInputSecs <= 0) {
      // Flash inputs to warn
      [inputH, inputM, inputS].forEach(el => {
        el.classList.add('border-red-500');
        setTimeout(() => el.classList.remove('border-red-500'), 1000);
      });
      return;
    }
    timerState.initialDurationSeconds = totalInputSecs;
    timerState.remainingSeconds = totalInputSecs;
    timerState.endTime = Date.now() + totalInputSecs * 1000;
  } else if (timerState.isPaused) {
    // Resume from paused duration
    if (timerState.overtimeMode) {
      // In overtime, endTime needs to be pushed forward by the elapsed seconds
      // so the count-up remains accurate relative to the paused moment
      timerState.endTime = Date.now() - Math.abs(timerState.remainingSeconds) * 1000;
    } else {
      timerState.endTime = Date.now() + timerState.remainingSeconds * 1000;
    }
    timerState.isPaused = false;
  }

  timerState.isTicking = true;
  
  // Set UI state
  btnStart.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg> Running...
  `;
  btnStart.classList.replace('bg-emerald-500', 'bg-emerald-400');
  btnStart.classList.add('pulse-alarm');
  btnPause.disabled = false;

  // Run the high precision drift loop
  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 200); // 5 ticks per sec for UI responsiveness
  
  updateDisplay();
}

function pauseTimer() {
  if (!timerState.isTicking) return;

  timerState.isTicking = false;
  timerState.isPaused = true;
  clearInterval(timerInterval);

  // Restore button state
  btnStart.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
    </svg> Resume Timer
  `;
  btnStart.classList.replace('bg-emerald-400', 'bg-emerald-500');
  btnStart.classList.remove('pulse-alarm');
  
  updateDisplay();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerState.isTicking = false;
  timerState.isPaused = false;
  timerState.overtimeMode = false;
  timerState.playedAlertChime = false;
  timerState.playedZeroChime = false;

  // Re-read initial duration
  timerState.remainingSeconds = timerState.initialDurationSeconds;
  
  // Reset buttons
  btnStart.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
    </svg> Start Countdown
  `;
  btnStart.classList.add('bg-emerald-500');
  btnStart.classList.remove('pulse-alarm');
  btnPause.disabled = true;

  updateDisplay();
}

function clearTimer() {
  clearInterval(timerInterval);
  timerState.isTicking = false;
  timerState.isPaused = false;
  timerState.overtimeMode = false;
  timerState.playedAlertChime = false;
  timerState.playedZeroChime = false;

  timerState.initialDurationSeconds = 1800;
  timerState.remainingSeconds = 1800;

  // Set Inputs back to default 30 mins
  inputH.value = 0;
  inputM.value = 30;
  inputS.value = 0;

  btnStart.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
    </svg> Start Countdown
  `;
  btnStart.classList.add('bg-emerald-500');
  btnStart.classList.remove('pulse-alarm');
  btnPause.disabled = true;

  updateDisplay();
}

// --- DYNAMIC TIME ADD/SUBTRACT DURING RUNTIME ---
function modifyRemainingTime(secondsToAdd) {
  if (timerState.overtimeMode) return; // Do not modify once time has expired

  // Adjust remaining time
  let newRemaining = timerState.remainingSeconds + secondsToAdd;
  if (newRemaining < 0) newRemaining = 0;

  timerState.remainingSeconds = newRemaining;
  
  // Also adjust initialTotalSeconds so alert percentages scale properly
  let newInitial = timerState.initialDurationSeconds + secondsToAdd;
  if (newInitial < 3) newInitial = 3;
  timerState.initialDurationSeconds = newInitial;

  // Update endpoint timestamp
  if (timerState.isTicking) {
    timerState.endTime = Date.now() + newRemaining * 1000;
  }

  // Readjust chime triggering if time was added back above threshold
  const currentRatio = newRemaining / newInitial;
  if (currentRatio > timerState.alertThreshold) {
    timerState.playedAlertChime = false;
  }

  updateDisplay();
}

// --- PRESSETS & INPUT EXTRACTORS ---
function getSecondsFromInputs() {
  const h = parseInt(inputH.value) || 0;
  const m = parseInt(inputM.value) || 0;
  const s = parseInt(inputS.value) || 0;
  return (h * 3600) + (m * 60) + s;
}

function loadPreset(seconds, name = "Custom Session", isTest = false) {
  // If ticking, pause first
  if (timerState.isTicking) {
    pauseTimer();
  }
  
  timerState.initialDurationSeconds = seconds;
  timerState.remainingSeconds = seconds;
  timerState.overtimeMode = false;
  timerState.isPaused = false;
  timerState.playedAlertChime = false;
  timerState.playedZeroChime = false;

  // Update inputs
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  inputH.value = h;
  inputM.value = m;
  inputS.value = s;

  // Update Display Label based on name
  let labelText = name;
  if (seconds === 2400 && name === "Sermon") labelText = "Sermon Session";
  else if (seconds === 900 && name === "Worship Sets") labelText = "Worship Performance";
  else if (seconds === 300 && name === "Announcements") labelText = "Announcements";
  else if (isTest) labelText = "Stage Timer Benchmark Test";
  
  elDisplayLabel.innerText = labelText;

  updateDisplay();
}

// --- DYNAMIC RENDERING & THEME APPLICATION ---

/**
 * Core rendering pipeline. Handles string formatting, dynamic colors, 
 * CSS heartbeat animations, and volume bars based on current status.
 */
function updateCurrentTimeDisplay() {
  if (!elCurrentTimeContainer || !elCurrentTimeDisplay) return;

  if (!timerState.isCurrentTimeEnabled) {
    elCurrentTimeContainer.classList.add('hidden');
    return;
  }

  elCurrentTimeContainer.classList.remove('hidden');

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  elCurrentTimeDisplay.innerText = `${hours}:${minutes}:${seconds}`;
}

function updateDisplay() {
  let formattedTime = "";

  if (timerState.overtimeMode) {
    formattedTime = "TIME UP";
  } else {
    const absoluteSecs = Math.abs(timerState.remainingSeconds);
    const hrs = Math.floor(absoluteSecs / 3600);
    const mins = Math.floor((absoluteSecs % 3600) / 60);
    const secs = absoluteSecs % 60;

    // Formatting strings
    const pad = (num) => String(num).padStart(2, '0');
    const shouldHideHourPrefix = timerState.isHourHidden && hrs === 0;
    
    if (timerState.isSecondsEnabled) {
      formattedTime = shouldHideHourPrefix
        ? `${pad(mins)}:${pad(secs)}`
        : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    } else {
      // Only display Hours and Minutes (highly requested stage clean-look option)
      formattedTime = shouldHideHourPrefix
        ? `${pad(mins)}`
        : `${pad(hrs)}:${pad(mins)}`;
    }
  }

  elDisplay.innerText = formattedTime;

  // Status Badge Rendering
  if (timerState.overtimeMode) {
    elStatusBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-red-500/30 text-xs font-semibold text-red-500 critical-alarm";
    elStatusText.innerText = "OVERTIME";
    elDisplayLabel.innerText = "Session Exceeded Limit";
  } else if (timerState.isPaused) {
    elStatusBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-amber-500/30 text-xs font-semibold text-amber-500";
    elStatusText.innerText = "PAUSED";
  } else if (timerState.isTicking) {
    // Determine dynamic alert state
    const currentRatio = timerState.remainingSeconds / timerState.initialDurationSeconds;
    if (currentRatio <= timerState.alertThreshold) {
      elStatusBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-rose-500/30 text-xs font-semibold text-rose-400 pulse-alarm";
      elStatusText.innerText = "CRITICAL ALERT";
      elDisplayLabel.innerText = "Session Ending Soon";
    } else {
      elStatusBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-emerald-500/30 text-xs font-semibold text-emerald-400";
      elStatusText.innerText = "TICKING";
    }
  } else {
    elStatusBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-zinc-800 text-xs font-semibold text-zinc-400";
    elStatusText.innerText = "READY";
  }

  // Dynamic CSS Variable adjustments & alerting
  const colors = getActiveColorSet();
  const docRoot = document.documentElement;

  if (timerState.overtimeMode) {
    // Hard Red / Alarm Color flashing
    docRoot.style.setProperty('--color-current', colors.alert);
    docRoot.style.setProperty('--glow-current', 'rgba(239, 68, 68, 0.45)');
    elDisplay.className = "font-digital clock-glow leading-none select-all relative select-none font-bold tabular-nums cursor-default critical-alarm";
    
    elProgressBar.style.width = "100%";
    elProgressBar.style.backgroundColor = colors.alert;
  } else {
    const currentRatio = timerState.remainingSeconds / timerState.initialDurationSeconds;
    const isAlertZone = currentRatio <= timerState.alertThreshold;

    if (isAlertZone) {
      docRoot.style.setProperty('--color-current', colors.alert);
      docRoot.style.setProperty('--glow-current', colors.alert + '55'); // append transparency for glow
      
      // Heartbeat pulse warning state
      elDisplay.className = "font-digital clock-glow leading-none select-all relative select-none font-bold tabular-nums cursor-default pulse-alarm";
      
      // Trigger Web Audio Warning alert once
      if (!timerState.playedAlertChime) {
        playBellChime('alert');
        timerState.playedAlertChime = true;
      }
    } else {
      // Healthy safe zone
      docRoot.style.setProperty('--color-current', colors.safe);
      docRoot.style.setProperty('--glow-current', colors.safe + '40');
      
      elDisplay.className = "font-digital clock-glow leading-none select-all relative select-none font-bold tabular-nums cursor-default";
    }

    // Update progress indicator bar
    const barPercent = Math.max(0, Math.min(100, currentRatio * 100));
    elProgressBar.style.width = `${barPercent}%`;
  }

  // Adjust stage font sizing to fill viewport safely
  fitClockText();
}

/**
 * Grabs the correct active colors depending on the active theme
 */
function getActiveColorSet() {
  if (currentTheme === 'custom') {
    return {
      safe: customColors.safe,
      alert: customColors.alert
    };
  }
  return THEMES[currentTheme] || THEMES['neon-forest'];
}

/**
 * Stage display scaling script. Automatically calculates how big
 * the typography can be dynamically to fill available width and height of panel.
 */
function fitClockText() {
  const containerWidth = elViewport.clientWidth;
  const containerHeight = elViewport.clientHeight;
  
  // Calculate relative safe boundaries based on viewport ratios
  const stageModeActive = elControls.classList.contains('hidden-stage') || document.body.classList.contains('stage-active');
  
  // Adjust sizing factors based on mode to leave beautiful spacing margins
  // In stage mode, the sidebar is hidden (display:none), giving us the full screen width.
  const widthFactor = stageModeActive ? 0.19 : 0.20;
  const heightFactor = stageModeActive ? 0.45 : 0.30;
  
  let fontSizeFromWidth = containerWidth * widthFactor;
  let fontSizeFromHeight = containerHeight * heightFactor;
  
  // Choose the limiting dimension to guarantee no overflowing wraps
  let idealFontSize = Math.min(fontSizeFromWidth, fontSizeFromHeight);
  
  // Absolute boundaries for sanity (minimum 40px, maximum 420px for clear stage visibility)
  idealFontSize = Math.max(40, Math.min(420, idealFontSize));
  
  elDisplay.style.fontSize = `${idealFontSize}px`;
}

// --- LOCAL STORAGE MANAGER ---
function savePreferences() {
  const preferences = {
    currentTheme,
    customColors,
    alertThreshold: timerState.alertThreshold,
    isSoundEnabled: timerState.isSoundEnabled,
    isSecondsEnabled: timerState.isSecondsEnabled,
    isHourHidden: timerState.isHourHidden,
    isCurrentTimeEnabled: timerState.isCurrentTimeEnabled,
    initialDurationSeconds: timerState.initialDurationSeconds
  };
  localStorage.setItem('stagetimer_preferences', JSON.stringify(preferences));
}

function loadPreferences() {
  try {
    const savedPresets = localStorage.getItem('stagetimer_presets');
    if (savedPresets) {
      const customPresets = JSON.parse(savedPresets);
      presets = [...presets.filter(p => p.isDefault), ...customPresets];
    }
  } catch (err) {
    console.warn("Loading presets failed: ", err);
  }

  // Render presets grid
  renderPresets();

  try {
    const data = localStorage.getItem('stagetimer_preferences');
    if (!data) return;

    const prefs = JSON.parse(data);
    
    // Restore variables
    currentTheme = prefs.currentTheme || 'neon-forest';
    customColors = prefs.customColors || { safe: '#10b981', alert: '#f43f5e' };
    timerState.alertThreshold = prefs.alertThreshold !== undefined ? prefs.alertThreshold : 0.35;
    timerState.isSoundEnabled = prefs.isSoundEnabled !== undefined ? prefs.isSoundEnabled : true;
    timerState.isSecondsEnabled = prefs.isSecondsEnabled !== undefined ? prefs.isSecondsEnabled : true;
    timerState.isHourHidden = prefs.isHourHidden !== undefined ? prefs.isHourHidden : false;
    timerState.isCurrentTimeEnabled = prefs.isCurrentTimeEnabled !== undefined ? prefs.isCurrentTimeEnabled : false;
    
    if (prefs.initialDurationSeconds) {
      timerState.initialDurationSeconds = prefs.initialDurationSeconds;
      timerState.remainingSeconds = prefs.initialDurationSeconds;
    }

    // Apply UI elements
    themeSelect.value = currentTheme;
    colorSafeInput.value = customColors.safe;
    colorAlertInput.value = customColors.alert;
    colorSafeLbl.innerText = customColors.safe.toUpperCase();
    colorAlertLbl.innerText = customColors.alert.toUpperCase();
    
    thresholdInput.value = Math.round(timerState.alertThreshold * 100);
    thresholdVal.innerText = `${Math.round(timerState.alertThreshold * 100)}%`;
    
    toggleSound.checked = timerState.isSoundEnabled;
    toggleHours.checked = timerState.isHourHidden;
    toggleCurrentTime.checked = timerState.isCurrentTimeEnabled;
    toggleSeconds.checked = timerState.isSecondsEnabled;

    // Apply custom view displays
    handleThemeSelection();

    // Map input boxes
    const h = Math.floor(timerState.initialDurationSeconds / 3600);
    const m = Math.floor((timerState.initialDurationSeconds % 3600) / 60);
    const s = timerState.initialDurationSeconds % 60;
    inputH.value = h;
    inputM.value = m;
    inputS.value = s;

  } catch (e) {
    console.warn("Preference restoration failed: ", e);
  }
}

// --- EVENT HANDLERS ---

function handleThemeSelection() {
  currentTheme = themeSelect.value;
  if (currentTheme === 'custom') {
    customColorsContainer.style.opacity = '1';
    customColorsContainer.style.pointerEvents = 'auto';
  } else {
    customColorsContainer.style.opacity = '0.35';
    customColorsContainer.style.pointerEvents = 'none';
  }
  
  savePreferences();
  updateDisplay();
}

/**
 * Toggles a fully immersive, zero-distraction clock-only full view
 */
function toggleStageMode(forceState = null) {
  const isCurrentlyStage = elControls.classList.contains('hidden-stage');
  const shouldBeStage = forceState !== null ? forceState : !isCurrentlyStage;

  if (shouldBeStage) {
    document.body.classList.add('stage-active');
    // Slide away side control deck and head console
    elHeader.classList.add('hidden-stage');
    elControls.classList.add('hidden-stage');
    
    // Floating Stage Modes UI
    stageIconStage.classList.add('hidden');
    stageIconExit.classList.remove('hidden');
    btnToggleStage.classList.replace('stage-toggle-btn', 'border-zinc-800');
    
    elExitHint.classList.remove('opacity-0');
    elExitHint.classList.add('opacity-40');

    // Float notification hint for operators briefly
    const flashAlert = document.createElement('div');
    flashAlert.className = "absolute bottom-10 px-6 py-3 rounded-xl bg-zinc-950/90 border border-zinc-800 text-zinc-300 text-xs font-semibold tracking-wider z-50 pointer-events-none transition-all duration-500 shadow-2xl";
    flashAlert.innerText = "HDMI STAGE DISPLAY MODE ACTIVE. PRESS ESC OR CLICK SCREEN TO CONFIG.";
    elViewport.appendChild(flashAlert);
    setTimeout(() => {
      flashAlert.style.opacity = '0';
      setTimeout(() => flashAlert.remove(), 1000);
    }, 4000);
  } else {
    document.body.classList.remove('stage-active');
    // Bring back panels
    elHeader.classList.remove('hidden-stage');
    elControls.classList.remove('hidden-stage');
    
    stageIconStage.classList.remove('hidden');
    stageIconExit.classList.add('hidden');
    
    elExitHint.classList.add('opacity-0');
    elExitHint.classList.remove('opacity-40');
  }

  // Sizing reflow delay to match CSS animations
  setTimeout(fitClockText, 350);
}

function handleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn(`Error enabling fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

// --- SETUP EVENT LISTENERS ---

// Playback Deck triggers
btnStart.addEventListener('click', () => {
  if (timerState.isTicking) {
    pauseTimer();
  } else {
    startTimer();
  }
});
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);
btnClear.addEventListener('click', clearTimer);

// Quick modify triggers (adds/subs seconds)
add10m.addEventListener('click', () => modifyRemainingTime(600));
add1m.addEventListener('click', () => modifyRemainingTime(60));
sub1m.addEventListener('click', () => modifyRemainingTime(-60));
sub10m.addEventListener('click', () => modifyRemainingTime(-600));

// --- UNIFIED INPUT VALIDATION FOR DIGITAL SPINNERS (MAX 2 DIGITS) ---
document.querySelectorAll('.time-input-spinner').forEach(input => {
  // Enforce max 2 characters as they type (prevents typing 3 or 4 digits)
  input.addEventListener('input', () => {
    if (input.value.length > 2) {
      input.value = input.value.slice(0, 2);
    }
    
    // Auto clamp max attributes during input to prevent manual typing exceeding limits
    const max = parseInt(input.getAttribute('max'));
    const val = parseInt(input.value);
    if (!isNaN(val) && max !== undefined && val > max) {
      input.value = max;
    }

    // Live update the countdown preview if the timer is stopped
    if (!timerState.isTicking && !timerState.isPaused && (input.id === 'input-h' || input.id === 'input-m' || input.id === 'input-s')) {
      const totalSecs = getSecondsFromInputs();
      timerState.initialDurationSeconds = totalSecs;
      timerState.remainingSeconds = totalSecs;
      updateDisplay();
    }
  });

  // Strict minimum/empty value clamp on blur
  input.addEventListener('blur', () => {
    let val = parseInt(input.value);
    const min = parseInt(input.getAttribute('min')) || 0;
    const max = parseInt(input.getAttribute('max')) || 99;

    if (isNaN(val)) {
      input.value = min;
    } else {
      if (val < min) input.value = min;
      if (val > max) input.value = max;
    }

    if (!timerState.isTicking && !timerState.isPaused && (input.id === 'input-h' || input.id === 'input-m' || input.id === 'input-s')) {
      const totalSecs = getSecondsFromInputs();
      timerState.initialDurationSeconds = totalSecs;
      timerState.remainingSeconds = totalSecs;
      updateDisplay();
    }
  });
});

// --- DYNAMIC PRESET CREATOR CONTROLLERS ---
const btnAddPresetToggle = document.getElementById('btn-add-preset-toggle');
const addPresetForm = document.getElementById('add-preset-form');
const presetNameInput = document.getElementById('preset-name-input');
const presetHInput = document.getElementById('preset-h-input');
const presetMInput = document.getElementById('preset-m-input');
const presetSInput = document.getElementById('preset-s-input');
const btnSavePreset = document.getElementById('btn-save-preset');
const btnCancelPreset = document.getElementById('btn-cancel-preset');

if (btnAddPresetToggle) {
  btnAddPresetToggle.addEventListener('click', () => {
    addPresetForm.classList.toggle('hidden');
    if (!addPresetForm.classList.contains('hidden')) {
      presetNameInput.focus();
    }
  });
}

if (btnCancelPreset) {
  btnCancelPreset.addEventListener('click', () => {
    addPresetForm.classList.add('hidden');
    presetNameInput.value = '';
    presetHInput.value = 0;
    presetMInput.value = 10;
    presetSInput.value = 0;
  });
}

if (btnSavePreset) {
  btnSavePreset.addEventListener('click', () => {
    const name = presetNameInput.value.trim() || "Custom Session";
    const h = parseInt(presetHInput.value) || 0;
    const m = parseInt(presetMInput.value) || 0;
    const s = parseInt(presetSInput.value) || 0;
    const seconds = (h * 3600) + (m * 60) + s;

    if (seconds <= 0) {
      alert("Duration must be at least 1 second.");
      return;
    }

    const newPreset = {
      id: 'preset-custom-' + Date.now(),
      name: name,
      seconds: seconds,
      isDefault: false
    };

    presets.push(newPreset);
    
    // Save to localStorage
    const customPresets = presets.filter(p => !p.isDefault);
    localStorage.setItem('stagetimer_presets', JSON.stringify(customPresets));
    
    // Reset Form
    presetNameInput.value = '';
    presetHInput.value = 0;
    presetMInput.value = 10;
    presetSInput.value = 0;
    addPresetForm.classList.add('hidden');
    
    // Re-render presets grid
    renderPresets();
  });
}

// Unified browser fullscreen synchronization
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = !!document.fullscreenElement;
  toggleStageMode(isFullscreen);
});

// Settings Preferences triggers
themeSelect.addEventListener('change', handleThemeSelection);

colorSafeInput.addEventListener('input', (e) => {
  customColors.safe = e.target.value;
  colorSafeLbl.innerText = customColors.safe.toUpperCase();
  savePreferences();
  updateDisplay();
});

colorAlertInput.addEventListener('input', (e) => {
  customColors.alert = e.target.value;
  colorAlertLbl.innerText = customColors.alert.toUpperCase();
  savePreferences();
  updateDisplay();
});

thresholdInput.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  timerState.alertThreshold = val / 100;
  thresholdVal.innerText = `${val}%`;
  savePreferences();
  updateDisplay();
});

toggleSound.addEventListener('change', (e) => {
  timerState.isSoundEnabled = e.target.checked;
  savePreferences();
});

toggleHours.addEventListener('change', (e) => {
  timerState.isHourHidden = e.target.checked;
  savePreferences();
  updateDisplay();
});

toggleCurrentTime.addEventListener('change', (e) => {
  timerState.isCurrentTimeEnabled = e.target.checked;
  savePreferences();
  updateCurrentTimeDisplay();
});

toggleSeconds.addEventListener('change', (e) => {
  timerState.isSecondsEnabled = e.target.checked;
  savePreferences();
  updateDisplay();
});

// Viewport Actions
btnToggleStage.addEventListener('click', (e) => {
  e.stopPropagation(); // Avoid triggering viewport click handler
  toggleStageMode();
});

elViewport.addEventListener('click', () => {
  // Click anywhere on clock screen during stage mode to return to console control panel
  if (elControls.classList.contains('hidden-stage')) {
    toggleStageMode(false);
  }
});

btnFullscreen.addEventListener('click', handleFullscreen);

// ESC Key exit handler
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    toggleStageMode(false);
  }
});

// Dynamic viewport scaling observer
window.addEventListener('resize', fitClockText);

// --- INITIALIZATION INITIAL START ---
// Set initial setup
loadPreferences();
updateDisplay();
updateCurrentTimeDisplay();
fitClockText();
setInterval(updateCurrentTimeDisplay, 1000);
// Secondary safety delay scaling to ensure WebFont load offsets are captured
setTimeout(fitClockText, 600);
