// app.js — Main application module

import { loadCities, searchCities } from './cities.js';
import { initCalendar, ensureAuth, listCalendars, createEvent } from './calendar.js';

// ===== STATE =====

const DEFAULT_CITIES = [
  { name: 'Berlin', country: 'DE', tz: 'Europe/Berlin' },
  { name: 'New York', country: 'US', tz: 'America/New_York' },
  { name: 'Tokyo', country: 'JP', tz: 'Asia/Tokyo' },
];

const state = {
  cities: loadFromStorage('wc_cities', DEFAULT_CITIES),
  scrubOffset: null, // minutes offset from now, null = live
  theme: loadFromStorage('wc_theme', 'system'),
};

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== TIMEZONE HELPERS =====

function getTimeForTz(tz, offset) {
  const now = new Date();
  if (offset !== null) {
    now.setMinutes(now.getMinutes() + offset);
  }
  return {
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }),
    abbr: getTimezoneAbbr(tz, now),
    day: now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }),
    date: now,
  };
}

function getTimezoneAbbr(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  return tzPart ? tzPart.value : tz;
}

function getMinutesInDay(tz, offset) {
  const now = new Date();
  if (offset !== null) {
    now.setMinutes(now.getMinutes() + offset);
  }
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false });
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ===== RENDERING =====

const clockGrid = document.getElementById('clockGrid');
const actionBar = document.getElementById('actionBar');
const resetBtn = document.getElementById('resetTimeBtn');

function renderClocks() {
  const count = state.cities.length;
  clockGrid.setAttribute('data-count', count <= 9 ? String(count) : 'many');

  clockGrid.innerHTML = state.cities.map((city, i) => {
    const info = getTimeForTz(city.tz, state.scrubOffset);
    const minutesInDay = getMinutesInDay(city.tz, state.scrubOffset);
    const pct = (minutesInDay / 1440) * 100;

    return `
      <div class="clock-col" data-index="${i}" data-tz="${city.tz}">
        <div class="clock-col__controls">
          ${i > 0 ? `<button class="clock-col__move" data-index="${i}" data-dir="-1" aria-label="Move left">←</button>` : ''}
          ${i < count - 1 ? `<button class="clock-col__move" data-index="${i}" data-dir="1" aria-label="Move right">→</button>` : ''}
          <button class="clock-col__remove" data-index="${i}" aria-label="Remove ${city.name}">remove</button>
        </div>
        <div class="clock-col__city">${city.name}</div>
        <div class="clock-col__time">${info.time}</div>
        <div class="clock-col__meta">${info.abbr} · ${info.day}</div>
        <div class="scrubber" data-index="${i}">
          <div class="scrubber__track">
            <div class="scrubber__handle" style="left: ${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Show/hide reset button
  resetBtn.hidden = state.scrubOffset === null;
}

// ===== THEME =====

function applyTheme() {
  const theme = state.theme;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  state.theme = next;
  saveToStorage('wc_theme', next);
  applyTheme();
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme();
});

// ===== LIVE TICK =====

let tickInterval = null;

function startTicking() {
  stopTicking();
  tickInterval = setInterval(() => {
    if (state.scrubOffset === null) renderClocks();
  }, 10_000); // every 10 seconds
}

function stopTicking() {
  if (tickInterval) clearInterval(tickInterval);
}

// ===== SCRUBBER =====

function initScrubber() {
  clockGrid.addEventListener('pointerdown', (e) => {
    const scrubber = e.target.closest('.scrubber');
    if (!scrubber) return;

    e.preventDefault();
    const track = scrubber.querySelector('.scrubber__track') || scrubber;
    const rect = track.getBoundingClientRect();

    const onMove = (moveEvent) => {
      const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
      const pct = x / rect.width;
      const targetMinutes = Math.round(pct * 1440); // 0-1440 minutes in day

      // Get this clock's timezone
      const tz = scrubber.closest('.clock-col').dataset.tz;
      const currentMinutes = getMinutesInDay(tz, null);
      let diff = targetMinutes - currentMinutes;

      // Wrap around midnight
      if (diff > 720) diff -= 1440;
      if (diff < -720) diff += 1440;

      state.scrubOffset = diff;
      renderClocks();
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);

    // Handle initial click position
    onMove(e);
  });
}

// ===== RESET TO NOW =====

resetBtn.addEventListener('click', () => {
  state.scrubOffset = null;
  renderClocks();
});

// ===== REMOVE CITY =====

clockGrid.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.clock-col__remove');
  if (!removeBtn) return;

  const index = parseInt(removeBtn.dataset.index);
  state.cities.splice(index, 1);
  saveToStorage('wc_cities', state.cities);
  renderClocks();
});

// ===== REORDER CITIES =====

clockGrid.addEventListener('click', (e) => {
  const moveBtn = e.target.closest('.clock-col__move');
  if (!moveBtn) return;

  const index = parseInt(moveBtn.dataset.index);
  const dir = parseInt(moveBtn.dataset.dir);
  const newIndex = index + dir;

  if (newIndex < 0 || newIndex >= state.cities.length) return;

  // Swap
  const temp = state.cities[index];
  state.cities[index] = state.cities[newIndex];
  state.cities[newIndex] = temp;

  saveToStorage('wc_cities', state.cities);
  renderClocks();
});

// ===== COPY SUMMARY =====

document.getElementById('copySummaryBtn').addEventListener('click', () => {
  const lines = state.cities.map(city => {
    const info = getTimeForTz(city.tz, state.scrubOffset);
    return `${city.name}: ${info.time} ${info.abbr}`;
  });
  const text = lines.join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('COPIED');
  });
});

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 1500);
}

// ===== CITY SEARCH OVERLAY =====

const cityOverlay = document.getElementById('cityOverlay');
const citySearch = document.getElementById('citySearch');
const cityResults = document.getElementById('cityResults');
let allCities = [];

document.getElementById('addCityBtn').addEventListener('click', async () => {
  if (!allCities.length) {
    allCities = await loadCities();
  }
  cityOverlay.hidden = false;
  citySearch.value = '';
  cityResults.innerHTML = '';
  citySearch.focus();
});

document.getElementById('cityOverlayClose').addEventListener('click', () => {
  cityOverlay.hidden = true;
});

cityOverlay.addEventListener('click', (e) => {
  if (e.target === cityOverlay) cityOverlay.hidden = true;
});

citySearch.addEventListener('input', () => {
  const results = searchCities(citySearch.value, allCities);
  cityResults.innerHTML = results.map(city => {
    const info = getTimeForTz(city.tz, null);
    return `<li data-tz="${city.tz}" data-name="${city.name}" data-country="${city.country}">
      <span class="city-name">${city.name}, ${city.country}</span>
      <span class="city-tz">${info.time} ${info.abbr}</span>
    </li>`;
  }).join('');
});

cityResults.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;

  const newCity = { name: li.dataset.name, country: li.dataset.country, tz: li.dataset.tz };

  // Don't add duplicates
  if (state.cities.some(c => c.tz === newCity.tz && c.name === newCity.name)) return;

  state.cities.push(newCity);
  saveToStorage('wc_cities', state.cities);
  cityOverlay.hidden = true;
  renderClocks();
});

// ===== CALENDAR EVENT =====

const calendarOverlay = document.getElementById('calendarOverlay');
const calendarSelect = document.getElementById('calendarSelect');
const durationPicker = document.getElementById('durationPicker');
const eventDate = document.getElementById('eventDate');
const eventTime = document.getElementById('eventTime');
const eventTzSelect = document.getElementById('eventTzSelect');
let selectedDuration = 60;

function prefillDateTime() {
  // Pre-fill with the currently displayed time (scrubbed or live)
  const now = new Date();
  if (state.scrubOffset !== null) {
    now.setMinutes(now.getMinutes() + state.scrubOffset);
  }

  // Use the first city's timezone for the default date/time display
  const tz = state.cities.length > 0 ? state.cities[0].tz : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  const localTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false });

  eventDate.value = localDate;
  eventTime.value = localTime;

  // Populate timezone selector with current cities
  eventTzSelect.innerHTML = state.cities.map((city, i) => {
    const abbr = getTimezoneAbbr(city.tz, now);
    return `<option value="${city.tz}" ${i === 0 ? 'selected' : ''}>${city.name} (${abbr})</option>`;
  }).join('');
}

document.getElementById('createEventBtn').addEventListener('click', async () => {
  const authed = await ensureAuth();
  if (!authed) {
    showToast('SIGN-IN REQUIRED');
    return;
  }

  try {
    const calendars = await listCalendars();
    calendarSelect.innerHTML = calendars.map(c =>
      `<option value="${c.id}">${c.summary}</option>`
    ).join('');
  } catch {
    calendarSelect.innerHTML = '<option value="primary">Primary</option>';
  }

  document.getElementById('eventTitle').value = '';
  selectedDuration = 60;
  updateDurationPicker();
  prefillDateTime();
  calendarOverlay.hidden = false;
  document.getElementById('eventTitle').focus();
});

durationPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.duration-picker__btn');
  if (!btn) return;
  selectedDuration = parseInt(btn.dataset.minutes);
  updateDurationPicker();
});

function updateDurationPicker() {
  durationPicker.querySelectorAll('.duration-picker__btn').forEach(btn => {
    btn.classList.toggle('duration-picker__btn--active', parseInt(btn.dataset.minutes) === selectedDuration);
  });
}

document.getElementById('calendarCreateBtn').addEventListener('click', async () => {
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) return;

  const calendarId = calendarSelect.value || 'primary';
  const dateVal = eventDate.value; // YYYY-MM-DD
  const timeVal = eventTime.value; // HH:MM
  const tz = eventTzSelect.value;

  if (!dateVal || !timeVal) {
    showToast('SET DATE & TIME');
    return;
  }

  // Build an ISO string with timezone info
  // We create the date in the selected timezone by computing the offset
  const localStr = `${dateVal}T${timeVal}:00`;
  const localDate = new Date(localStr);

  // Get the offset for the selected timezone at that date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(localDate);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');
  const offsetStr = offsetPart ? offsetPart.value.replace('GMT', '') : '+00:00';
  const isoWithTz = `${dateVal}T${timeVal}:00${offsetStr || '+00:00'}`;

  // Build description with timezone summary at the event time
  const eventStartDate = new Date(isoWithTz);
  const description = state.cities.map(city => {
    const time = eventStartDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: city.tz, hour12: false });
    const abbr = getTimezoneAbbr(city.tz, eventStartDate);
    return `${city.name}: ${time} ${abbr}`;
  }).join('\n');

  try {
    await createEvent({
      calendarId,
      title,
      startTime: isoWithTz,
      durationMinutes: selectedDuration,
      description,
    });
    calendarOverlay.hidden = true;
    showToast('EVENT CREATED');
  } catch (err) {
    showToast('ERROR: ' + err.message);
  }
});

document.getElementById('calendarCancelBtn').addEventListener('click', () => {
  calendarOverlay.hidden = true;
});

calendarOverlay.addEventListener('click', (e) => {
  if (e.target === calendarOverlay) calendarOverlay.hidden = true;
});

// ===== INIT =====

// Init Google Calendar — retry until GIS script is loaded
function tryInitCalendar() {
  if (window.google?.accounts?.oauth2) {
    initCalendar();
  } else {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        initCalendar();
      } else if (attempts > 10) {
        clearInterval(interval);
        console.warn('Google Identity Services did not load. Calendar features unavailable.');
      }
    }, 500);
  }
}

applyTheme();
renderClocks();
initScrubber();
startTicking();
tryInitCalendar();
