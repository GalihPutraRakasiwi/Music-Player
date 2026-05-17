"use strict";

// ── Service Worker ──────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW failed:", err));
  });
}

// ── Media Session API ───────────────────────────────────────────────────────
// Ini yang membuat kontrol muncul di lock screen / notification bar HP
function updateMediaSession(song) {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name,
    artist: song.artist,
    album: "Wavvy",
    artwork: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  });

  // Tombol di lock screen / notification
  navigator.mediaSession.setActionHandler("play", () => {
    audio.play().catch(() => {});
    state.playing = true;
    updatePlayBtn();
    updateArtSpinner();
    updateWaveform();
    navigator.mediaSession.playbackState = "playing";
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    audio.pause();
    state.playing = false;
    updatePlayBtn();
    updateArtSpinner();
    updateWaveform();
    navigator.mediaSession.playbackState = "paused";
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    nextSong();
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    prevSong();
  });

  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (details.seekTime !== undefined) {
      audio.currentTime = details.seekTime;
    }
  });

  navigator.mediaSession.setActionHandler("seekbackward", (details) => {
    audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
  });

  navigator.mediaSession.setActionHandler("seekforward", (details) => {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + (details.seekOffset || 10));
  });
}

// Sync playback state ke Media Session
function syncMediaSessionState() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";

  // Update position state (progress bar di lock screen)
  if (audio.duration && !isNaN(audio.duration)) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      });
    } catch (_) {}
  }
}

// Hook ke audio events untuk sync posisi
audio.addEventListener("play", () => syncMediaSessionState());
audio.addEventListener("pause", () => syncMediaSessionState());
audio.addEventListener("timeupdate", () => {
  // Update posisi setiap 5 detik agar tidak boros
  if (Math.floor(audio.currentTime) % 5 === 0) syncMediaSessionState();
});

// Override updateNowPlaying dari app.js agar juga update Media Session
const _origUpdateNowPlaying = updateNowPlaying;
window.updateNowPlaying = function (song) {
  _origUpdateNowPlaying(song);
  updateMediaSession(song);
  syncMediaSessionState();
};

// ── Install prompt (tambah ke home screen) ─────────────────────────────────
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Tampilkan tombol install kalau belum ada
  if (!document.getElementById("install-btn")) {
    const btn = document.createElement("button");
    btn.id = "install-btn";
    btn.className = "upload-btn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
        <path d="M12 2v13M8 11l4 4 4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      </svg>
      Install App
    `;
    btn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        btn.remove();
        showToast("Wavvy berhasil diinstall!");
      }
      deferredPrompt = null;
    };
    document.querySelector(".sidebar-bottom").prepend(btn);
  }
});

window.addEventListener("appinstalled", () => {
  document.getElementById("install-btn")?.remove();
  showToast("Wavvy berhasil diinstall ke home screen!");
  deferredPrompt = null;
});
