/**
 * Royal Bridal Wedding Invitation
 * - Luxury Wax-Seal Envelope Intro with 3D Flap Opening & Radiant Light Burst
 * - Cinematic Ultra-Smooth Video Scroll Animation (188 Frames, Sub-Frame Cross-Blending)
 * - Traditional Wedding Music Engine with floating toggle
 * - Calendar Invite Generator (.ics)
 */
(() => {
  const FRAME_COUNT = 188;
  const isMobile = Math.min(window.innerWidth, window.innerHeight) < 768;
  const FRAME_DIR = isMobile ? 'frames/mobile' : 'frames/desktop';
  const frameUrl = (i) => `${FRAME_DIR}/frame_${String(i + 1).padStart(4, '0')}.webp`;

  // DOM Elements
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d', { alpha: false });
  const intro = document.getElementById('intro');
  const sealTrigger = document.getElementById('seal-trigger');
  const ringProgress = document.getElementById('ring-progress');
  const sealPct = document.getElementById('seal-pct');
  const bgMusic = document.getElementById('bg-music');
  const musicBtn = document.getElementById('music-btn');
  const btnCalendar = document.getElementById('btn-calendar');
  const panels = [...document.querySelectorAll('.panel')];

  const CIRCUMFERENCE = 2 * Math.PI * 59; // 370.718
  const frames = new Array(FRAME_COUNT);

  let vw = 0, vh = 0, dpr = 1;
  let target = 0;     // Target scroll progress (0..1)
  let current = 0;    // Eased playhead progress
  let lastDrawn = -1;
  let lastTime = performance.now();
  let isEnvelopeOpened = false;
  let isMusicPlaying = false;

  /* =========================================================
     1. PROGRESSIVE FRAME LOADER & DECODER
     ========================================================= */
  async function loadFrame(i) {
    const img = new Image();
    img.decoding = 'async';
    img.src = frameUrl(i);
    await img.decode();
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(img);
      } catch (_) {
        // Fall back to HTMLImageElement if ImageBitmap is unsupported
      }
    }
    return img;
  }

  // Hierarchical loading order: coarse keyframes first for instant readiness
  function loadOrder() {
    const last = FRAME_COUNT - 1;
    const seen = new Set([0, last]);
    const order = [0, last];
    for (const step of [8, 4, 2, 1]) {
      for (let i = 0; i < FRAME_COUNT; i += step) {
        if (!seen.has(i)) {
          seen.add(i);
          order.push(i);
        }
      }
    }
    return order;
  }

  function preload(onReady) {
    const order = loadOrder();
    const revealAt = Math.min(24, Math.ceil(FRAME_COUNT / 8)); // Unlock ready in under 0.6s
    let done = 0;
    let next = 0;
    let readyTriggered = false;

    const worker = async () => {
      while (next < order.length) {
        const i = order[next++];
        try {
          frames[i] = await loadFrame(i);
        } catch (e) {
          console.warn('Frame failed to load:', i, e);
        }
        done++;

        // Update circular wax seal progress
        const overallPct = Math.min(100, Math.round((done / FRAME_COUNT) * 100));
        
        if (ringProgress) {
          const offset = CIRCUMFERENCE * (1 - overallPct / 100);
          ringProgress.style.strokeDashoffset = offset;
        }
        if (sealPct) {
          sealPct.textContent = `${overallPct}%`;
        }

        if (i === 0) resize();
        lastDrawn = -1;

        if (!readyTriggered && done >= revealAt) {
          readyTriggered = true;
          onReady();
        }
      }
    };

    // 12 parallel decoding streams for instantaneous throughput
    return Promise.all(Array.from({ length: 12 }, worker));
  }

  /* =========================================================
     2. WAX SEAL & ENVELOPE OPENING INTERACTION
     ========================================================= */
  function openEnvelope() {
    if (isEnvelopeOpened) return;
    isEnvelopeOpened = true;

    // Start background wedding music on user interaction
    playMusic();

    // Trigger opening animation classes
    intro.classList.add('opening');

    // Chime or haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 100]);
    }

    setTimeout(() => {
      intro.classList.add('opened');
      document.body.classList.remove('loading');
      readScroll();
      current = target;
      lastDrawn = -1;
      draw(current);
      updatePanels(current);
      requestAnimationFrame(tick);
    }, 950);
  }

  sealTrigger.addEventListener('click', openEnvelope);
  sealTrigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEnvelope();
    }
  });

  /* =========================================================
     3. AUDIO CONTROLS
     ========================================================= */
  function playMusic() {
    if (!bgMusic) return;
    bgMusic.play().then(() => {
      isMusicPlaying = true;
      musicBtn.classList.remove('muted');
    }).catch(() => {
      // Autoplay policy fallback
      isMusicPlaying = false;
      musicBtn.classList.add('muted');
    });
  }

  function toggleMusic() {
    if (!bgMusic) return;
    if (isMusicPlaying) {
      bgMusic.pause();
      isMusicPlaying = false;
      musicBtn.classList.add('muted');
    } else {
      bgMusic.play();
      isMusicPlaying = true;
      musicBtn.classList.remove('muted');
    }
  }

  musicBtn.addEventListener('click', toggleMusic);

  /* =========================================================
     4. ULTRA-SMOOTH CANVAS RENDERING & COVER
     ========================================================= */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    lastDrawn = -1;
    draw(current);
  }

  function cover(img, alpha) {
    const iw = img.width, ih = img.height;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / iw, ch / ih);
    const w = iw * scale, h = ih * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < FRAME_COUNT; d++) {
      const prev = i - d;
      if (prev >= 0 && frames[prev]) return frames[prev];
      const next = i + d;
      if (next < FRAME_COUNT && frames[next]) return frames[next];
    }
    return frames[0] || null;
  }

  function draw(progress) {
    const pos = progress * (FRAME_COUNT - 1);
    const a = Math.floor(pos);
    const b = Math.min(FRAME_COUNT - 1, a + 1);
    const t = pos - a;

    const imgA = nearest(a);
    if (!imgA) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    cover(imgA, 1);

    // Continuous sub-frame cross-fade: smoothstep around hand-off avoids ghosting and stepping
    if (b !== a && frames[b]) {
      const x = Math.min(1, Math.max(0, (t - 0.2) / 0.6));
      const w = x * x * (3 - 2 * x);
      if (w > 0.002) {
        cover(frames[b], w);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* =========================================================
     5. SCROLL TEXT PANELS
     ========================================================= */
  function updatePanels(p) {
    for (const el of panels) {
      const s = parseFloat(el.dataset.start);
      const e = parseFloat(el.dataset.end);
      const fade = Math.min(0.06, (e - s) / 2.8);
      let o = 0;

      if (p >= s && p <= e) {
        const fadeIn = s <= 0 ? 1 : (p - s) / fade;
        const fadeOut = e >= 1 ? 1 : (e - p) / fade;
        o = Math.min(1, fadeIn, fadeOut);
      }
      o = Math.max(0, o);

      const lift = (1 - o) * 30 * (p < (s + e) / 2 ? 1 : -1);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0)`;
      el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
  }

  /* =========================================================
     6. MAIN ANIMATION LOOP (INSTANT ZERO-LATENCY LERP EASING)
     ========================================================= */
  let isTicking = false;

  function scheduleTick() {
    if (!isTicking && isEnvelopeOpened) {
      isTicking = true;
      lastTime = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    scheduleTick();
  }

  function tick(now) {
    const dt = Math.min(48, now - lastTime);
    lastTime = now;

    // Responsive damping factor (~0.22) eliminates dragging lag while maintaining silky fluidity
    const k = 1 - Math.pow(1 - 0.22, dt / 16.67);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0001) current = target;

    if (Math.abs(current - lastDrawn) > 0.00002) {
      draw(current);
      updatePanels(current);
      lastDrawn = current;
    }

    // Keep RAF active while settling; sleep when settled to save 100% CPU/GPU and eliminate battery jitter
    if (Math.abs(target - current) > 0.0001 && isEnvelopeOpened) {
      requestAnimationFrame(tick);
    } else {
      isTicking = false;
    }
  }

  /* =========================================================
     7. CALENDAR (.ICS) EVENT GENERATION
     ========================================================= */
  if (btnCalendar) {
    btnCalendar.addEventListener('click', (e) => {
      e.preventDefault();
      const icsData = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Royal Wedding Invitation//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'SUMMARY:Sowmya & Rahul - Auspicious Wedding Muhurtham',
        'DESCRIPTION:You are cordially invited to celebrate the sacred wedding ceremony of Sowmya and Rahul.',
        'LOCATION:Sri Meenakshi Sundareswarar Mandapam, Temple Ring Road, Chennai, Tamil Nadu',
        'DTSTART:20261214T050000Z',
        'DTEND:20261214T080000Z',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'Sowmya-Rahul-Wedding.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Smooth scroll prompt to enter Mandapam
  const scrollPrompt = document.getElementById('scroll-prompt');
  if (scrollPrompt) {
    scrollPrompt.addEventListener('click', () => {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    });
  }

  // Replay animation button
  const btnScrollTop = document.getElementById('btn-scroll-top');
  if (btnScrollTop) {
    btnScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Live Countdown Timer
  function initCountdown() {
    const weddingDate = new Date('2026-12-14T10:30:00+05:30').getTime();
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (!daysEl) return;

    function update() {
      const now = Date.now();
      const diff = Math.max(0, weddingDate - now);

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      daysEl.textContent = String(d).padStart(2, '0');
      hoursEl.textContent = String(h).padStart(2, '0');
      minsEl.textContent = String(m).padStart(2, '0');
      secsEl.textContent = String(s).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
  }
  initCountdown();

  // Scroll reveal for ceremony cards (left-to-right & right-to-left)
  function initCardAnimations() {
    const eventCards = document.querySelectorAll('.event-card');
    if (!eventCards.length) return;

    if ('IntersectionObserver' in window) {
      const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      }, { threshold: 0.15 });

      eventCards.forEach((card) => cardObserver.observe(card));
    } else {
      eventCards.forEach((card) => card.classList.add('in-view'));
    }
  }
  initCardAnimations();

  // Click-to-switch font previewer for "You are Invited"
  const scriptTitle = document.getElementById('main-script-title');
  if (scriptTitle) {
    const fonts = [
      { name: 'Playfair Display Italic', family: "'Playfair Display', Georgia, serif", italic: true },
      { name: 'Cormorant Garamond Italic', family: "'Cormorant Garamond', Georgia, serif", italic: true },
      { name: 'Great Vibes', family: "'Great Vibes', cursive" },
      { name: 'Pinyon Script', family: "'Pinyon Script', cursive" },
      { name: 'Parisienne', family: "'Parisienne', cursive" }
    ];
    let fontIdx = 0;

    scriptTitle.style.cursor = 'pointer';
    scriptTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      fontIdx = (fontIdx + 1) % fonts.length;
      const chosen = fonts[fontIdx];
      scriptTitle.style.fontFamily = chosen.family;
      scriptTitle.style.fontStyle = chosen.italic ? 'italic' : 'normal';
      scriptTitle.title = `Current font: ${chosen.name} (Click to switch)`;
    });
  }

  // Click-to-switch font previewer for Footer Blessing
  const blessingTitle = document.getElementById('blessing-title');
  if (blessingTitle) {
    const blessingFonts = [
      { name: 'Playfair Display Italic', family: "'Playfair Display', Georgia, serif", italic: true, weight: '600' },
      { name: 'Cormorant Garamond Italic', family: "'Cormorant Garamond', Georgia, serif", italic: true, weight: '600' },
      { name: 'Cinzel Roman', family: "'Cinzel', serif", italic: false, weight: '600' },
      { name: 'Pinyon Script', family: "'Pinyon Script', cursive", italic: false, weight: '400' },
      { name: 'Great Vibes', family: "'Great Vibes', cursive", italic: false, weight: '400' }
    ];
    let bFontIdx = 0;

    blessingTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      bFontIdx = (bFontIdx + 1) % blessingFonts.length;
      const chosen = blessingFonts[bFontIdx];
      blessingTitle.style.fontFamily = chosen.family;
      blessingTitle.style.fontStyle = chosen.italic ? 'italic' : 'normal';
      blessingTitle.style.fontWeight = chosen.weight;
      blessingTitle.title = `Current font: ${chosen.name} (Click to switch)`;
    });
  }

  /* =========================================================
     8. INITIALIZATION
     ========================================================= */
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - vw) > 1 || Math.abs(window.innerHeight - vh) > 120) {
      resize();
    }
  });

  window.scrollTo(0, 0);
  resize();

  // Start preloading frames immediately
  preload(() => {
    // When enough keyframes are ready, unlock the seal for tap-to-open
    sealTrigger.classList.add('ready');
  });

})();
