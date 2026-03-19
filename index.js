  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  const clampInt = (n, min = 0, max = Infinity) => {
    n = Number(n);
    if (!Number.isFinite(n)) return min;
    n = Math.trunc(n);
    return Math.min(max, Math.max(min, n));
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  // ===== Elements (required) =====
  const hoursEl = $("hours");
  const minutesEl = $("minutes");
  const secondsEl = $("seconds");

  const startBtn = $("startBtn");
  const resetBtn = $("resetBtn");

  const hhEl = $("hh");
  const mmEl = $("mm");
  const ssEl = $("ss");

  // ===== Optional elements =====
  const helperText = $("helperText");
  const stateBadge = $("stateBadge");

  // ===== Safety checks =====
  if (!hoursEl || !minutesEl || !secondsEl || !startBtn || !resetBtn || !hhEl || !mmEl || !ssEl) {
    console.error("Missing one or more required elements. Check your HTML IDs.");
    // return null;
  }

  // ===== Inject blink style (in case your CSS doesn't have it) =====
  // This ensures TIME UP keeps blinking until reset.
  (function ensureBlinkStyle(){
    const styleId = "timeup-blink-style";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes timeupBlink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      .timeup-blink {
        animation: timeupBlink 1.75s steps(2, end) infinite;
      }
    `;
    document.head.appendChild(style);
  })();

  // ===== State =====
  let intervalId = null;
  let remainingSeconds = 0;
  let running = false;
  let timeUp = false;

  // ===== Separator control =====
  function setSeparatorsVisible(visible) {
    // Your HTML likely uses elements with class "sep"
    const seps = document.querySelectorAll(".sep");
    seps.forEach(sep => {
      sep.style.display = visible ? "" : "none";
      sep.setAttribute("aria-hidden", visible ? "false" : "true");
    });
  }

  // ===== Display control =====
  function setTimeDisplayFromSeconds(totalSec) {
    const sec = Math.max(0, totalSec);

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    hhEl.textContent = pad2(h);
    mmEl.textContent = pad2(m);
    ssEl.textContent = pad2(s);
  }

  function setIdleUI() {
    timeUp = false;
    running = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    // Restore separators
    setSeparatorsVisible(true);

    // Remove blink
    hhEl.classList.remove("timeup-blink");

    // Re-enable inputs/buttons
    hoursEl.disabled = false;
    minutesEl.disabled = false;
    secondsEl.disabled = false;

    startBtn.disabled = false;

    // Reset button can stay enabled
    resetBtn.disabled = false;

    // Optional UI updates
    if (stateBadge) {
      stateBadge.textContent = "Idle";
      stateBadge.classList.remove("badge-running", "badge-finished");
      stateBadge.classList.add("badge-idle");
    }
    if (helperText) {
      helperText.textContent = "Enter values and press Start.";
    }
  }

  function setTimeUpMode() {
    timeUp = true;
    running = false;

    // Stop ticking
    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    // Disable inputs so user can't change during TIME UP
    hoursEl.disabled = true;
    minutesEl.disabled = true;
    secondsEl.disabled = true;

    // Disable Start to force Reset flow
    startBtn.disabled = true;

    // Keep Reset enabled
    resetBtn.disabled = false;

    // Hide separators and show TIME UP
    setSeparatorsVisible(false);

    hhEl.textContent = "TIME";
    mmEl.textContent = "UP";
    ssEl.textContent = "!";

    // Keep blinking until reset
    hhEl.classList.add("timeup-blink");
    mmEl.classList.add("timeup-blink");
    ssEl.classList.add("timeup-blink");

    // Optional UI updates
    if (stateBadge) {
      stateBadge.textContent = "Finished";
      stateBadge.classList.remove("badge-idle", "badge-running");
      stateBadge.classList.add("badge-finished");
    }
    if (helperText) {
      helperText.innerHTML = `Time is up — press <strong>Reset</strong> to try again.`;
    }
  }

  // ===== Core countdown =====
  function readInputsToSeconds() {
    const h = clampInt(hoursEl.value, 0, 24);
    const m = clampInt(minutesEl.value, 0, 59);
    const s = clampInt(secondsEl.value, 0, 59);
    return h * 3600 + m * 60 + s;
  }

  function startCountdown() {
    if (running) return;

    const total = readInputsToSeconds();

    if (total <= 0) {
      // If user starts with 0, treat as immediate TIME UP
      setTimeUpMode();
      return;
    }

    remainingSeconds = total;
    running = true;

    // UI: enable running state
    setSeparatorsVisible(true);
    hhEl.classList.remove("timeup-blink");
    mmEl.classList.remove("timeup-blink");
    ssEl.classList.remove("timeup-blink");

    // Enable/disable controls
    hoursEl.disabled = true;
    minutesEl.disabled = true;
    secondsEl.disabled = true;

    startBtn.disabled = true;
    resetBtn.disabled = false;

    if (stateBadge) {
      stateBadge.textContent = "Running";
      stateBadge.classList.remove("badge-idle", "badge-finished");
      stateBadge.classList.add("badge-running");
    }
    if (helperText) helperText.textContent = "Countdown started…";

    // Set initial display immediately
    setTimeDisplayFromSeconds(remainingSeconds);

    // Tick each second
    intervalId = setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        setTimeUpMode();
        return;
      }

      setTimeDisplayFromSeconds(remainingSeconds);
    }, 1000);
  }

  function resetAll() {
    // Clear timer
    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    // Reset UI + states
    // Also remove TIME UP blink and restore separators
    hhEl.classList.remove("timeup-blink");
    mmEl.classList.remove("timeup-blink");
    ssEl.classList.remove("timeup-blink");
    setIdleUI();

    // Optionally reset the input/display values to 00:00:00
    hoursEl.value = "0";
    minutesEl.value = "0";
    secondsEl.value = "0";

    setTimeDisplayFromSeconds(0);

    // Optional helper updates
    if (helperText) helperText.textContent = "Enter values and press Start.";
  }

  // ===== Wire events =====
  startBtn.addEventListener("click", () => {
    // If currently TIME UP, we require reset first (because start is disabled in that mode)
    if (timeUp) return;
    startCountdown();
  });

  resetBtn.addEventListener("click", () => {
    resetAll();
  });

  // ===== Initial state =====
  resetAll();