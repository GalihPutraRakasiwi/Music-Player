"use strict";

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  songs: [], // { id, name, duration, file, url, favored }
  queue: [], // array of song ids (manual queue)
  currentIndex: -1,
  playing: false,
  shuffle: false,
  repeat: "none", // 'none' | 'all' | 'one'
  volume: 0.8,
  muted: false,
  filter: "",
  sort: "default",
  shuffleOrder: [],
  shufflePos: -1,
  usingQueue: false,
};

const audio = document.getElementById("audio");

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function showToast(msg) {
  let t = document.getElementById("_toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "_toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function filteredSongs() {
  let list = [...state.songs];
  if (state.filter) {
    const q = state.filter.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (state.sort === "title") list.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === "duration") list.sort((a, b) => a.duration - b.duration);
  return list;
}

function favoriteSongs() {
  return state.songs.filter((s) => s.favored);
}

// ── File handling ──────────────────────────────────────────────────────────
function handleFiles(files) {
  const audioFiles = Array.from(files).filter((f) => f.type.startsWith("audio/"));
  if (!audioFiles.length) {
    showToast("Tidak ada file audio yang dipilih");
    return;
  }

  audioFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const id = uid();

    // Use filename as title (strip extension only, keep everything else)
    let name = file.name.replace(/\.[^.]+$/, "").trim();
    if (!name) name = file.name;

    const song = { id, name, duration: 0, file, url, favored: false };
    state.songs.push(song);

    // Get duration
    const tmp = new Audio(url);
    tmp.addEventListener(
      "loadedmetadata",
      () => {
        song.duration = tmp.duration;
        renderAll();
      },
      { once: true },
    );
  });

  renderAll();
  showToast(`${audioFiles.length} lagu ditambahkan`);
}

document.getElementById("file-input").addEventListener("change", (e) => handleFiles(e.target.files));
document.getElementById("folder-input").addEventListener("change", (e) => handleFiles(e.target.files));

// ── Drag & drop ────────────────────────────────────────────────────────────
const overlay = document.getElementById("drop-overlay");
let dragCounter = 0;

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  overlay.classList.add("active");
});
document.addEventListener("dragleave", () => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    overlay.classList.remove("active");
  }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  overlay.classList.remove("active");
  handleFiles(e.dataTransfer.files);
});

// ── Render ─────────────────────────────────────────────────────────────────
function renderAll() {
  renderLibrary();
  renderQueue();
  renderFavorites();
}

function songRowHTML(song, index, isActive, context) {
  const favClass = song.favored ? "fav-active" : "";
  return `
  <div class="song-row ${isActive ? "active" : ""}" 
       onclick="playSongById('${song.id}', '${context}')"
       data-id="${song.id}">
    <div class="sr-num">
      <span class="sr-num-txt">${index + 1}</span>
      <span class="sr-play-icon">▶</span>
    </div>
    <div class="sr-info">
      <div class="sr-title">${escHtml(song.name)}</div>
    </div>
    <div class="sr-dur">${fmtTime(song.duration)}</div>
    <div class="sr-actions">
      <button class="${favClass}" onclick="toggleFavorite(event,'${song.id}')" title="Favorite">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button class="desktop-only" onclick="addToQueue(event,'${song.id}')" title="Tambah ke queue">
        <svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
      </button>
      <button class="desktop-only" onclick="removeSong(event,'${song.id}')" title="Hapus">
        <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  </div>`;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderLibrary() {
  const list = filteredSongs();
  const empty = document.getElementById("empty-state");
  const songList = document.getElementById("song-list");
  const rows = document.getElementById("song-rows");

  if (state.songs.length === 0) {
    empty.style.display = "flex";
    songList.classList.add("hidden");
    return;
  }
  empty.style.display = "none";
  songList.classList.remove("hidden");

  const currentId = state.currentIndex >= 0 ? filteredSongs()[state.currentIndex]?.id : null;
  rows.innerHTML = list.map((s, i) => songRowHTML(s, i, s.id === currentId, "library")).join("");
}

function renderQueue() {
  const rows = document.getElementById("queue-rows");
  const empty = document.getElementById("queue-empty");

  if (state.queue.length === 0) {
    rows.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  const currentId = state.usingQueue ? state.queue[0] : null;
  rows.innerHTML = state.queue
    .map((id, i) => {
      const s = state.songs.find((x) => x.id === id);
      if (!s) return "";
      return songRowHTML(s, i, id === currentId, "queue");
    })
    .join("");
}

function renderFavorites() {
  const rows = document.getElementById("fav-rows");
  const empty = document.getElementById("fav-empty");
  const list = favoriteSongs();

  if (list.length === 0) {
    rows.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  const currentId = state.currentIndex >= 0 ? filteredSongs()[state.currentIndex]?.id : null;
  rows.innerHTML = list.map((s, i) => songRowHTML(s, i, s.id === currentId, "favorites")).join("");
}

// ── Playback ───────────────────────────────────────────────────────────────
function playSongById(id, context) {
  const list = context === "queue" ? state.queue.map((qid) => state.songs.find((s) => s.id === qid)).filter(Boolean) : context === "favorites" ? favoriteSongs() : filteredSongs();

  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;

  state.usingQueue = context === "queue";
  state.currentIndex = idx;
  loadAndPlay(list[idx]);

  if (state.shuffle) buildShuffleOrder(list, idx);
}

function loadAndPlay(song) {
  if (!song) return;

  audio.pause();
  audio.currentTime = 0;
  audio.src = "";

  audio.volume = state.muted ? 0 : state.volume;
  audio.src = song.url;
  audio.load();

  const tryPlay = () => {
    audio
      .play()
      .then(() => {
        state.playing = true;
        updatePlayBtn();
        updateArtSpinner();
        updateWaveform();
      })
      .catch((err) => {
        console.error("Play error:", err);
        showToast("Gagal memutar lagu, coba klik lagi");
      });
  };

  audio.addEventListener("canplay", tryPlay, { once: true });

  state.playing = false;
  updateNowPlaying(song);
  updatePlayBtn();
  updateArtSpinner();
  updateWaveform();
  renderAll();
}

function updateNowPlaying(song) {
  document.getElementById("np-title").textContent = song.name;
  document.getElementById("np-artist").textContent = "";
  document.getElementById("mini-title").textContent = song.name;

  const fb = document.getElementById("fav-btn");
  fb.classList.toggle("active", song.favored);

  const miniArt = document.getElementById("mini-art");
  miniArt.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke="var(--text3)" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function getCurrentSong() {
  if (state.usingQueue && state.queue.length > 0) {
    return state.songs.find((s) => s.id === state.queue[0]) || null;
  }
  const list = filteredSongs();
  return list[state.currentIndex] || null;
}

function togglePlay() {
  if (!audio.src) return;
  if (state.playing) {
    audio.pause();
    state.playing = false;
  } else {
    audio.play().catch(() => {});
    state.playing = true;
  }
  updatePlayBtn();
  updateArtSpinner();
  updateWaveform();
}

function updatePlayBtn() {
  const btn = document.getElementById("play-btn");
  if (state.playing) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;stroke:none"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;stroke:none"><path d="M5 3l14 9-14 9V3z"/></svg>`;
  }
}

function updateArtSpinner() {
  document.getElementById("np-art").classList.toggle("playing", state.playing);
}

function updateWaveform() {
  document.getElementById("waveform").classList.toggle("playing", state.playing);
}

function nextSong() {
  if (state.usingQueue && state.queue.length > 0) {
    state.queue.shift();
    if (state.queue.length > 0) {
      const s = state.songs.find((x) => x.id === state.queue[0]);
      if (s) {
        loadAndPlay(s);
        return;
      }
    }
    state.usingQueue = false;
  }

  const list = filteredSongs();
  if (!list.length) return;

  if (state.shuffle) {
    state.shufflePos = (state.shufflePos + 1) % state.shuffleOrder.length;
    state.currentIndex = state.shuffleOrder[state.shufflePos];
  } else {
    state.currentIndex = (state.currentIndex + 1) % list.length;
  }
  loadAndPlay(list[state.currentIndex]);
}

function prevSong() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const list = filteredSongs();
  if (!list.length) return;

  if (state.shuffle) {
    state.shufflePos = (state.shufflePos - 1 + state.shuffleOrder.length) % state.shuffleOrder.length;
    state.currentIndex = state.shuffleOrder[state.shufflePos];
  } else {
    state.currentIndex = (state.currentIndex - 1 + list.length) % list.length;
  }
  loadAndPlay(list[state.currentIndex]);
}

// ── Shuffle ────────────────────────────────────────────────────────────────
function buildShuffleOrder(list, currentIdx) {
  const order = list.map((_, i) => i).filter((i) => i !== currentIdx);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.shuffleOrder = [currentIdx, ...order];
  state.shufflePos = 0;
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  document.getElementById("shuffle-btn").classList.toggle("active", state.shuffle);
  showToast(state.shuffle ? "Shuffle aktif" : "Shuffle nonaktif");
  if (state.shuffle) buildShuffleOrder(filteredSongs(), state.currentIndex);
}

// ── Repeat ─────────────────────────────────────────────────────────────────
function cycleRepeat() {
  const modes = ["none", "all", "one"];
  state.repeat = modes[(modes.indexOf(state.repeat) + 1) % 3];
  const btn = document.getElementById("repeat-btn");
  const one = document.getElementById("repeat-one");
  btn.classList.toggle("active", state.repeat !== "none");
  one.classList.toggle("hidden", state.repeat !== "one");
  const labels = { none: "Repeat nonaktif", all: "Repeat semua", one: "Repeat satu" };
  showToast(labels[state.repeat]);
}

// ── Audio events ───────────────────────────────────────────────────────────
audio.addEventListener("ended", () => {
  if (state.repeat === "one") {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  if (state.repeat === "all" || state.shuffle || state.currentIndex < filteredSongs().length - 1) {
    nextSong();
  } else {
    state.playing = false;
    updatePlayBtn();
    updateArtSpinner();
    updateWaveform();
  }
});

audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("loadedmetadata", updateProgress);

function updateProgress() {
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  const pct = dur ? (cur / dur) * 100 : 0;

  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-thumb").style.left = pct + "%";
  document.getElementById("time-current").textContent = fmtTime(cur);
  document.getElementById("time-total").textContent = fmtTime(dur);
}

function seekTo(e) {
  const bar = document.getElementById("progress-bar");
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * (audio.duration || 0);
}

// Touch seek support
(function () {
  const bar = document.getElementById("progress-bar");
  bar.addEventListener("touchstart", handleTouchSeek, { passive: false });
  bar.addEventListener("touchmove", handleTouchSeek, { passive: false });
  function handleTouchSeek(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    audio.currentTime = pct * (audio.duration || 0);
  }
})();

// ── Volume ─────────────────────────────────────────────────────────────────
function setVolume(e) {
  const bar = document.getElementById("volume-bar");
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.volume = pct;
  state.muted = false;
  audio.volume = pct;
  updateVolumeUI();
}

function updateMuteBtn() {
  const btn = document.getElementById("mute-btn");
  if (!btn) return;
  if (state.muted || state.volume === 0) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }
}

function toggleMute() {
  state.muted = !state.muted;
  audio.volume = state.muted ? 0 : state.volume;
  updateMuteBtn();
}

function updateVolumeUI() {
  document.getElementById("volume-fill").style.width = state.volume * 100 + "%";
  const thumb = document.querySelector(".volume-thumb");
  if (thumb) thumb.style.left = state.volume * 100 + "%";
  updateMuteBtn();
}

audio.volume = state.volume;

// ── Favorites ──────────────────────────────────────────────────────────────
function toggleFavorite(e, id) {
  e.stopPropagation();
  const song = state.songs.find((s) => s.id === id);
  if (!song) return;
  song.favored = !song.favored;
  showToast(song.favored ? `♥ ${song.name} ditambahkan ke favorit` : `Dihapus dari favorit`);
  renderAll();

  const current = getCurrentSong();
  if (current && current.id === id) {
    document.getElementById("fav-btn").classList.toggle("active", song.favored);
  }
}

function toggleFavoriteCurrent() {
  const s = getCurrentSong();
  if (!s) return;
  toggleFavorite({ stopPropagation: () => {} }, s.id);
}

// ── Queue ──────────────────────────────────────────────────────────────────
function addToQueue(e, id) {
  e.stopPropagation();
  if (state.queue.includes(id)) {
    showToast("Sudah ada di queue");
    return;
  }
  state.queue.push(id);
  const s = state.songs.find((x) => x.id === id);
  showToast(`Ditambahkan ke queue: ${s?.name || ""}`);
  renderQueue();
}

function clearQueue() {
  state.queue = [];
  state.usingQueue = false;
  showToast("Queue dikosongkan");
  renderQueue();
}

function toggleQueue() {
  switchView("queue");
}

// ── Remove song ────────────────────────────────────────────────────────────
function removeSong(e, id) {
  e.stopPropagation();
  const idx = state.songs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const current = getCurrentSong();
  const wasPlaying = current && current.id === id;

  URL.revokeObjectURL(state.songs[idx].url);
  state.songs.splice(idx, 1);
  state.queue = state.queue.filter((q) => q !== id);

  if (wasPlaying) {
    audio.pause();
    audio.src = "";
    state.playing = false;
    state.currentIndex = -1;
    document.getElementById("np-title").textContent = "Tidak ada lagu";
    document.getElementById("np-artist").textContent = "—";
    document.getElementById("mini-title").textContent = "—";
    updatePlayBtn();
    updateArtSpinner();
    updateWaveform();
  }

  renderAll();
  showToast("Lagu dihapus dari library");
}

// ── Search & sort ──────────────────────────────────────────────────────────
function filterSongs() {
  state.filter = document.getElementById("search-input").value;
  renderLibrary();
}

function sortSongs() {
  state.sort = document.getElementById("sort-select").value;
  renderLibrary();
}

// ── View switching ─────────────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".mobile-nav button").forEach((b) => b.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  const navBtn = document.querySelector(`[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add("active");
  renderAll();
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT") return;

  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  if (e.code === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 10);
  if (e.code === "ArrowUp") {
    state.volume = Math.min(1, state.volume + 0.05);
    audio.volume = state.volume;
    updateVolumeUI();
  }
  if (e.code === "ArrowDown") {
    state.volume = Math.max(0, state.volume - 0.05);
    audio.volume = state.volume;
    updateVolumeUI();
  }
  if (e.code === "KeyN" && e.ctrlKey) {
    e.preventDefault();
    nextSong();
  }
  if (e.code === "KeyP" && e.ctrlKey) {
    e.preventDefault();
    prevSong();
  }
  if (e.code === "KeyS" && e.ctrlKey) {
    e.preventDefault();
    toggleShuffle();
  }
  if (e.code === "KeyM") toggleMute();
});

// ── Init ───────────────────────────────────────────────────────────────────
renderAll();
updateMuteBtn();
