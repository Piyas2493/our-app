/*
 * Jeeva mic — vanilla JS, zero dependencies. Handles getUserMedia,
 * live level sampling for the orb, and silence-based turn-taking.
 *
 * Same split as orb.js: the level sampler runs on setInterval, never on
 * requestAnimationFrame (a backgrounded tab stops rAF and the mic would
 * silently look dead -- see "things that will break" #1). Recording
 * itself is MediaRecorder, never the browser's Web Speech API, so audio
 * goes to the server (and eventually Bhashini) instead of a vendor's
 * cloud with no visibility into where it went.
 */
(function () {
  "use strict";

  // ---- named constants (tune here, not inline) ----------------------
  var SILENCE_MS = 900; // conversation: end a turn after this much quiet
  var SCRIBE_SILENCE_MS = 2600; // scribe mode: a thinking patient isn't done
  var SILENCE_FLOOR = 0.08; // normalized 0..1 level below which "quiet" counts
  var LEVEL_SAMPLE_MS = 50; // level-sampler cadence (~20Hz)

  function rmsLevel(analyser, buffer) {
    analyser.getByteTimeDomainData(buffer);
    var sumSquares = 0;
    for (var i = 0; i < buffer.length; i++) {
      var normalized = (buffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    var rms = Math.sqrt(sumSquares / buffer.length);
    // RMS of typical speech rarely approaches 1.0 -- scale up so the
    // orb's listening ring actually moves instead of sitting near zero.
    return Math.min(1, rms * 4);
  }

  function describeGetUserMediaError(err) {
    if (!err || !err.name) return "Microphone unavailable.";
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Microphone permission denied.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone found.";
      case "NotReadableError":
        return "Microphone is in use by another application.";
      default:
        return "Microphone error: " + err.name;
    }
  }

  function JeevaMic(opts) {
    opts = opts || {};
    this.onLevel = opts.onLevel || function () {};
    this.onTurnEnd = opts.onTurnEnd || function () {};
    this.onError = opts.onError || function () {};
    this.silenceMs = opts.silenceMs || SILENCE_MS;
    this.silenceFloor = opts.silenceFloor || SILENCE_FLOOR;

    this._stream = null;
    this._audioCtx = null;
    this._analyser = null;
    this._buffer = null;
    this._recorder = null;
    this._chunks = [];
    this._sampleInterval = null;
    this._silenceStartedAt = null;
    this._hasSpeechThisTurn = false;
    this._gated = false;
    this._running = false;
  }

  JeevaMic.SILENCE_MS = SILENCE_MS;
  JeevaMic.SCRIBE_SILENCE_MS = SCRIBE_SILENCE_MS;
  JeevaMic.SILENCE_FLOOR = SILENCE_FLOOR;

  /** Mic permission check without prompting -- lets the caller show a
   * reason before the browser's own prompt appears, per
   * navigator.permissions guidance in "things that will break" #2. */
  JeevaMic.checkPermission = async function () {
    if (!navigator.permissions || !navigator.permissions.query) {
      return "unknown";
    }
    try {
      var status = await navigator.permissions.query({ name: "microphone" });
      return status.state; // "granted" | "denied" | "prompt"
    } catch (err) {
      return "unknown";
    }
  };

  JeevaMic.prototype.start = async function () {
    if (this._running) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError("Microphone not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      this.onError("Audio recording not supported in this browser.");
      return;
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.onError(describeGetUserMediaError(err));
      return;
    }

    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var source = this._audioCtx.createMediaStreamSource(this._stream);
    this._analyser = this._audioCtx.createAnalyser();
    this._analyser.fftSize = 1024;
    // Deliberately NOT connected to this._audioCtx.destination --
    // otherwise the mic would echo back through the speakers.
    source.connect(this._analyser);
    this._buffer = new Uint8Array(this._analyser.fftSize);

    this._running = true;
    this._startRecorder();
    this._sampleInterval = setInterval(this._sample.bind(this), LEVEL_SAMPLE_MS);
  };

  JeevaMic.prototype._startRecorder = function () {
    this._chunks = [];
    this._hasSpeechThisTurn = false;
    this._silenceStartedAt = null;

    var mimeType = "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    this._recorder = mimeType
      ? new MediaRecorder(this._stream, { mimeType: mimeType })
      : new MediaRecorder(this._stream);

    var self = this;
    this._recorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) self._chunks.push(e.data);
    };
    this._recorder.onstop = function () {
      if (self._chunks.length === 0) return;
      var blob = new Blob(self._chunks, { type: self._recorder.mimeType || "audio/webm" });
      self.onTurnEnd(blob);
    };
    this._recorder.start();
  };

  /** Called on the level-sample cadence, never from rAF. */
  JeevaMic.prototype._sample = function () {
    if (this._gated) {
      // Jeeva is speaking -- mic reads as silent so it never
      // transcribes its own voice through the laptop speakers.
      this.onLevel(0);
      return;
    }

    var level = rmsLevel(this._analyser, this._buffer);
    this.onLevel(level);

    var now = performance.now();
    if (level < this.silenceFloor) {
      if (this._silenceStartedAt === null) this._silenceStartedAt = now;
      var quietFor = now - this._silenceStartedAt;
      if (this._hasSpeechThisTurn && quietFor >= this.silenceMs) {
        this._endTurn();
      }
    } else {
      this._silenceStartedAt = null;
      this._hasSpeechThisTurn = true;
    }
  };

  JeevaMic.prototype._endTurn = function () {
    if (this._recorder && this._recorder.state !== "inactive") {
      this._recorder.stop(); // onstop fires onTurnEnd with the blob
    }
    this._startRecorder(); // immediately ready for the next turn
  };

  /** Mute level/turn-taking while Jeeva is speaking -- "the mic goes
   * deaf while Jeeva speaks." Actually pauses the MediaRecorder (not
   * just the level/silence logic): without this, the recorder kept
   * capturing audio the whole time Jeeva talked, so whatever leaked
   * from the speakers into the mic got baked into the *next* turn's
   * blob -- Bhashini would transcribe Jeeva's own voice back, Jeeva
   * would speak that, the mic would catch that too, and so on forever
   * (found 2026-09-14: reported as "two voices colliding and repeating
   * continuously"). Pausing means literally no audio is captured while
   * gated, so there is nothing left to echo. */
  JeevaMic.prototype.setGated = function (gated) {
    this._gated = !!gated;
    if (this._recorder) {
      if (gated && this._recorder.state === "recording") {
        this._recorder.pause();
      } else if (!gated && this._recorder.state === "paused") {
        this._recorder.resume();
      }
    }
    if (!gated) {
      this._silenceStartedAt = null;
    }
  };

  /** Use a longer silence window for scribe mode, where a patient
   * pausing to think is not a finished turn. */
  JeevaMic.prototype.setSilenceMs = function (ms) {
    this.silenceMs = ms;
  };

  JeevaMic.prototype.stop = function () {
    this._running = false;
    if (this._sampleInterval) clearInterval(this._sampleInterval);
    if (this._recorder && this._recorder.state !== "inactive") {
      this._recorder.onstop = null; // don't fire a spurious turn on manual stop
      this._recorder.stop();
    }
    if (this._stream) {
      this._stream.getTracks().forEach(function (track) {
        track.stop();
      });
    }
    if (this._audioCtx) this._audioCtx.close();
  };

  window.JeevaMic = JeevaMic;
})();
