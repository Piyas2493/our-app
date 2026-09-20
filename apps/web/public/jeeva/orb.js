/*
 * Jeeva orb — vanilla JS, canvas-only, zero dependencies.
 *
 * Deliberately framework-agnostic: this file talks to a <canvas> element
 * through the plain DOM API, not React. It is loaded with a <script> tag
 * (see JeevaOrb.tsx) and attaches a single global, window.JeevaOrb, so it
 * can also be dropped straight into a non-React kiosk page later (the
 * Rogi /intake route) without any bundler involved.
 *
 * Two separate loops, on purpose (see "things that will break" #1):
 *   - requestAnimationFrame drives DRAWING only. It pauses in a
 *     backgrounded tab, which is fine — nothing needs to draw there.
 *   - Audio level sampling is fed in from OUTSIDE via setLevel(), on
 *     whatever cadence the caller chooses (setInterval against a real
 *     AnalyserNode in later steps; a fake generator in the dev harness
 *     for now). rAF must never be the thing reading the mic level.
 */
(function () {
  "use strict";

  // ---- named constants (tune here, not inline) ----------------------
  var BREATH_MS = 4000; // dormant breathing cycle
  var WAKE_MS = 220; // tap-to-bloom transition, must feel instant
  var THINK_DEG_PER_SEC = 220; // thinking-arc rotation speed
  var SCRIBE_PULSE_MS = 5000; // scribing dim pulse, slower & quieter than dormant
  var SPEAK_WAVE_MS = 1400; // outward wave period at rest (no level yet)
  var LISTEN_POINTS = 28; // points around the listening ring

  var STATES = [
    "dormant",
    "waking",
    "speaking",
    "listening",
    "thinking",
    "scribing",
    "error",
  ];

  // Red accent, warm-grounded dark ground.
  // The tridosha triad (Vata/Pitta/Kapha) is reserved for dosha
  // attribution elsewhere in the app and is deliberately NOT used here;
  // the orb communicates system state, not clinical content.
  var COLOR = {
    bg: "#1a1512",
    dim: "rgba(212, 52, 44, 0.35)",
    accent: "#d4342c",
    accentBright: "#f0645c",
    critical: "#c65b45",
  };

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function JeevaOrb(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onStateChange = opts.onStateChange || function () {};

    this.state = "dormant";
    this.stateEnteredAt = performance.now();
    this.level = 0; // 0..1, set externally via setLevel()
    this._pendingNextState = null;
    this._raf = null;
    this._destroyed = false;

    this._resize();
    this._boundResize = this._resize.bind(this);
    window.addEventListener("resize", this._boundResize);

    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  JeevaOrb.STATES = STATES;

  JeevaOrb.prototype._resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) || 96;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = size / 2;
    this.cy = size / 2;
    this.baseRadius = size * 0.22;
  };

  /** Set the current animation state. Most states apply immediately;
   * "waking" is special — see wake(). */
  JeevaOrb.prototype.setState = function (name) {
    if (STATES.indexOf(name) === -1) {
      throw new Error("Unknown Jeeva orb state: " + name);
    }
    if (name === this.state) return;
    this.state = name;
    this.stateEnteredAt = performance.now();
    this.onStateChange(name);
  };

  /** Play the 220ms wake bloom, then land on nextState. This is the
   * only feedback the user gets before audio starts — never skip it. */
  JeevaOrb.prototype.wake = function (nextState) {
    this._pendingNextState = nextState || "speaking";
    this.setState("waking");
    var self = this;
    setTimeout(function () {
      if (self._destroyed) return;
      if (self.state === "waking") {
        self.setState(self._pendingNextState);
      }
    }, WAKE_MS);
  };

  /** Fed from outside on whatever cadence the caller samples audio at
   * (never from this file's own rAF loop). v is 0..1. */
  JeevaOrb.prototype.setLevel = function (v) {
    this.level = clamp01(v);
  };

  /** Puts the orb in the error state and returns the DOM message the
   * caller should render as visible text — this file never draws text
   * on the canvas itself, so it stays selectable/accessible/localisable. */
  JeevaOrb.prototype.error = function () {
    this.setState("error");
  };

  JeevaOrb.prototype.destroy = function () {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._boundResize);
  };

  JeevaOrb.prototype._loop = function (t) {
    if (this._destroyed) return;
    this._draw(t);
    this._raf = requestAnimationFrame(this._loop);
  };

  JeevaOrb.prototype._draw = function (t) {
    var ctx = this.ctx;
    var cx = this.cx,
      cy = this.cy,
      r = this.baseRadius;
    var elapsed = t - this.stateEnteredAt;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    switch (this.state) {
      case "dormant":
        this._drawDormant(ctx, cx, cy, r, t);
        break;
      case "waking":
        this._drawWaking(ctx, cx, cy, r, elapsed);
        break;
      case "speaking":
        this._drawSpeaking(ctx, cx, cy, r, t);
        break;
      case "listening":
        this._drawListening(ctx, cx, cy, r, t);
        break;
      case "thinking":
        this._drawThinking(ctx, cx, cy, r, t);
        break;
      case "scribing":
        this._drawScribing(ctx, cx, cy, r, t);
        break;
      case "error":
        this._drawError(ctx, cx, cy, r);
        break;
    }
  };

  function circle(ctx, cx, cy, r, fill, alpha) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ring(ctx, cx, cy, r, stroke, width, alpha) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 1. dormant — small, dim, slow breath. Present but asleep.
  JeevaOrb.prototype._drawDormant = function (ctx, cx, cy, r, t) {
    var phase = (t % BREATH_MS) / BREATH_MS;
    var breath = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    var radius = r * 0.55 * (0.92 + 0.08 * breath);
    circle(ctx, cx, cy, radius, COLOR.accent, 0.35 + 0.2 * breath);
  };

  // 2. waking — 220ms scale-up and bloom. Never skipped.
  JeevaOrb.prototype._drawWaking = function (ctx, cx, cy, r, elapsed) {
    var p = clamp01(elapsed / WAKE_MS);
    var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    var radius = r * (0.55 + 0.45 * eased);
    var bloomRadius = radius * (1 + 0.6 * (1 - eased));
    circle(ctx, cx, cy, bloomRadius, COLOR.accentBright, 0.25 * (1 - eased));
    circle(ctx, cx, cy, radius, COLOR.accent, 0.6 + 0.4 * eased);
  };

  // 3. speaking — concentric waves travelling outward, amplitude from
  // the real TTS level (idles gently at level 0 so it still reads alive).
  JeevaOrb.prototype._drawSpeaking = function (ctx, cx, cy, r, t) {
    circle(ctx, cx, cy, r * 0.55, COLOR.accent, 0.85);
    var amp = 0.15 + this.level * 0.85;
    var waveCount = 3;
    for (var i = 0; i < waveCount; i++) {
      var phase = ((t % SPEAK_WAVE_MS) / SPEAK_WAVE_MS + i / waveCount) % 1;
      var radius = r * (0.7 + phase * 1.6 * amp);
      var alpha = (1 - phase) * 0.5 * amp;
      ring(ctx, cx, cy, radius, COLOR.accentBright, 2, alpha);
    }
  };

  // 4. listening — ring deforms to the live mic level. Flat ring means
  // dead mic, visible without being told.
  JeevaOrb.prototype._drawListening = function (ctx, cx, cy, r, t) {
    circle(ctx, cx, cy, r * 0.4, COLOR.accent, 0.9);
    var base = r * 1.1;
    var amp = r * 0.55 * this.level;
    ctx.beginPath();
    for (var i = 0; i <= LISTEN_POINTS; i++) {
      var angle = (i / LISTEN_POINTS) * Math.PI * 2;
      var wobble = Math.sin(angle * 3 + t * 0.004) * 0.5 + 0.5;
      var radius = base + amp * wobble;
      var x = cx + Math.cos(angle) * radius;
      var y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = COLOR.accentBright;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.5 * this.level;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // 5. thinking — single rotating arc, otherwise still. Must never be
  // confused with "listening".
  JeevaOrb.prototype._drawThinking = function (ctx, cx, cy, r, t) {
    circle(ctx, cx, cy, r * 0.5, COLOR.accent, 0.5);
    var angle = ((t * THINK_DEG_PER_SEC) / 1000 / 180) * Math.PI;
    var sweep = Math.PI / 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, angle, angle + sweep);
    ctx.strokeStyle = COLOR.accentBright;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  // 6. scribing — quiet double ring, low brightness. Listening but will
  // not answer; must be unmistakable at a glance (consent, not decor).
  JeevaOrb.prototype._drawScribing = function (ctx, cx, cy, r, t) {
    var phase = (t % SCRIBE_PULSE_MS) / SCRIBE_PULSE_MS;
    var pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    circle(ctx, cx, cy, r * 0.35, COLOR.accent, 0.25 + 0.1 * pulse);
    ring(ctx, cx, cy, r * 0.8, COLOR.accent, 1.5, 0.2 + 0.1 * pulse);
    ring(ctx, cx, cy, r * 1.05, COLOR.accent, 1.5, 0.15 + 0.1 * pulse);
  };

  // 7. error — desaturated, motion stopped, hairline in critical colour.
  // The visible text line is rendered by the caller in the DOM, not here.
  JeevaOrb.prototype._drawError = function (ctx, cx, cy, r) {
    circle(ctx, cx, cy, r * 0.55, "#5a5a58", 0.5);
    ring(ctx, cx, cy, r * 1.05, COLOR.critical, 1, 0.9);
  };

  window.JeevaOrb = JeevaOrb;
})();
