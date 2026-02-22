import {
  initFirebase, subscribeToMonth, createDay, updateDay, deleteDay,
  moveDayToDate, getSettings, saveSettings, subscribeToSettings
} from './firebase.js';
import {
  renderCalendar, computeWeeklyProgress, suggestedContentType,
  DEFAULT_ENDEAVORS, ICON_PRESETS, endeavorMap
} from './calendar.js';

// ===== State =====
let currentYear, currentMonth;
let unsubMonth = null;
let unsubSettings = null;
let currentDaysMap = new Map();
let endeavors = [...DEFAULT_ENDEAVORS];

// ===== DOM refs =====
const grid = document.getElementById('calendar-grid');
const monthLabel = document.getElementById('month-label');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const legend = document.getElementById('legend');

// Day modal
const backdrop = document.getElementById('modal-backdrop');
const modalDate = document.getElementById('modal-date');
const modalType = document.getElementById('modal-type');
const modalTitle = document.getElementById('modal-title');
const modalNotes = document.getElementById('modal-notes');
const modalDone = document.getElementById('modal-done');
const modalSave = document.getElementById('modal-save');
const modalDelete = document.getElementById('modal-delete');
const modalClose = document.getElementById('modal-close');
const platInstagram = document.getElementById('plat-instagram');
const platTiktok = document.getElementById('plat-tiktok');
const platTwitch = document.getElementById('plat-twitch');

// Settings modal
const settingsBtn = document.getElementById('settings-btn');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');
const endeavorsList = document.getElementById('endeavors-list');

// Quest path
const questAvatar = document.getElementById('quest-avatar');
const pathFill = document.getElementById('path-fill');
const checkpointsEl = document.getElementById('checkpoints');
const goldCountEl = document.getElementById('gold-count');

let editingDate = null;
let editingDocId = null;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  // Load settings first, then start
  unsubSettings = subscribeToSettings((data) => {
    if (data && data.endeavors && data.endeavors.length === 3) {
      endeavors = data.endeavors;
    } else {
      endeavors = [...DEFAULT_ENDEAVORS];
    }
    renderLegend();
    rebuildTypeSelector();
    // Re-render calendar with new endeavors
    renderCalendar(grid, currentYear, currentMonth, currentDaysMap, endeavors, {
      onDayClick: openModal,
      onDrop: handleDrop,
    });
    updateQuestPath();
  });

  loadMonth();
  wireEvents();
});

function loadMonth() {
  monthLabel.textContent = `${MONTHS[currentMonth - 1]} ${currentYear}`;
  if (unsubMonth) unsubMonth();

  unsubMonth = subscribeToMonth(currentYear, currentMonth, (daysMap) => {
    currentDaysMap = daysMap;
    renderCalendar(grid, currentYear, currentMonth, daysMap, endeavors, {
      onDayClick: openModal,
      onDrop: handleDrop,
    });
    updateQuestPath();
  });
}

// ===== Legend =====
function renderLegend() {
  legend.innerHTML = '';
  endeavors.forEach(e => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${e.color}"></span>${e.icon} ${e.label}`;
    legend.appendChild(item);
  });
}

// ===== Type Selector (dynamic) =====
function rebuildTypeSelector() {
  modalType.innerHTML = '';
  endeavors.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'type-btn';
    btn.dataset.type = e.key;
    btn.style.setProperty('--type-color', e.color);
    btn.textContent = `${e.icon} ${e.label}`;
    btn.addEventListener('click', () => {
      modalType.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const defaults = e.platforms;
      platInstagram.checked = defaults.includes('instagram');
      platTiktok.checked = defaults.includes('tiktok');
      platTwitch.checked = defaults.includes('twitch');
    });
    modalType.appendChild(btn);
  });
}

// ===== Quest Path =====
function updateQuestPath() {
  const weeks = computeWeeklyProgress(currentYear, currentMonth, currentDaysMap);
  checkpointsEl.innerHTML = '';

  let completedWeeks = 0;
  let goldCoins = 0;

  weeks.forEach((w, i) => {
    const cp = document.createElement('div');
    cp.className = 'checkpoint';

    // Half week = 4+ done days (or half of total if partial week)
    const threshold = Math.ceil(w.total / 2);
    const isCompleted = w.completed >= threshold;
    const isGold = w.completed >= w.total && w.total > 0;

    if (isCompleted) {
      cp.classList.add('completed');
      completedWeeks++;
    }
    if (isGold) {
      cp.classList.add('has-gold');
      goldCoins++;
    }

    cp.innerHTML = `
      <div class="checkpoint-coin"></div>
      <div class="checkpoint-node"></div>
      <span class="checkpoint-label">Wk${i + 1}</span>
    `;

    checkpointsEl.appendChild(cp);
  });

  goldCountEl.textContent = goldCoins;

  // Avatar position
  const totalCheckpoints = weeks.length;
  if (totalCheckpoints > 0) {
    // Position avatar at the last completed checkpoint
    const progress = completedWeeks / totalCheckpoints;
    const pathWidth = checkpointsEl.offsetWidth;
    const avatarOffset = progress * (pathWidth - 48) + 12;
    questAvatar.style.left = avatarOffset + 'px';

    // Fill the path line
    pathFill.style.width = (progress * (pathWidth - 48)) + 'px';
  }
}

// ===== Events =====
function wireEvents() {
  prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    loadMonth();
  });
  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    loadMonth();
  });

  // Day modal
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  modalSave.addEventListener('click', handleSave);
  modalDelete.addEventListener('click', handleDelete);

  // Settings modal
  settingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', (e) => { if (e.target === settingsBackdrop) closeSettings(); });
  settingsSave.addEventListener('click', handleSaveSettings);

  // Escape closes any modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeSettings();
    }
  });

  // Checkbox toggle via event delegation
  grid.addEventListener('toggle-done', async (e) => {
    const { docId, done } = e.detail;
    if (docId) await updateDay(docId, { done });
  });
}

// ===== Day Modal =====
function openModal(dateStr, dayData) {
  editingDate = dateStr;
  editingDocId = dayData ? dayData.docId : null;

  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = d.toLocaleDateString('en-US', { month: 'long' });
  modalDate.textContent = `${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()}`;

  const eMap = endeavorMap(endeavors);

  if (dayData) {
    selectType(dayData.contentType);
    modalTitle.value = dayData.title || '';
    modalNotes.value = dayData.notes || '';
    modalDone.checked = !!dayData.done;
    const plats = dayData.platforms || [];
    platInstagram.checked = plats.includes('instagram');
    platTiktok.checked = plats.includes('tiktok');
    platTwitch.checked = plats.includes('twitch');
    modalDelete.style.display = '';
  } else {
    const sugKey = suggestedContentType(dateStr, endeavors);
    selectType(sugKey);
    modalTitle.value = '';
    modalNotes.value = '';
    modalDone.checked = false;
    const sug = eMap[sugKey];
    const defaults = sug ? sug.platforms : [];
    platInstagram.checked = defaults.includes('instagram');
    platTiktok.checked = defaults.includes('tiktok');
    platTwitch.checked = defaults.includes('twitch');
    modalDelete.style.display = 'none';
  }

  backdrop.classList.remove('hidden');
}

function closeModal() {
  backdrop.classList.add('hidden');
  editingDate = null;
  editingDocId = null;
}

function selectType(typeKey) {
  modalType.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === typeKey);
  });
}

function getSelectedType() {
  const active = modalType.querySelector('.type-btn.active');
  return active ? active.dataset.type : endeavors[0].key;
}

function getSelectedPlatforms() {
  const platforms = [];
  if (platInstagram.checked) platforms.push('instagram');
  if (platTiktok.checked) platforms.push('tiktok');
  if (platTwitch.checked) platforms.push('twitch');
  return platforms;
}

async function handleSave() {
  const data = {
    date: editingDate,
    contentType: getSelectedType(),
    title: modalTitle.value.trim(),
    notes: modalNotes.value.trim(),
    platforms: getSelectedPlatforms(),
    done: modalDone.checked
  };

  if (editingDocId) {
    await updateDay(editingDocId, data);
  } else {
    await createDay(data);
  }
  closeModal();
}

async function handleDelete() {
  if (editingDocId) await deleteDay(editingDocId);
  closeModal();
}

async function handleDrop(docId, newDate) {
  if (docId && newDate) await moveDayToDate(docId, newDate);
}

// ===== Settings Modal =====
function openSettings() {
  renderEndeavorsForm();
  settingsBackdrop.classList.remove('hidden');
}

function closeSettings() {
  settingsBackdrop.classList.add('hidden');
}

function renderEndeavorsForm() {
  endeavorsList.innerHTML = '';

  endeavors.forEach((e, idx) => {
    const row = document.createElement('div');
    row.className = 'endeavor-row';
    row.dataset.idx = idx;

    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'endeavor-color';
    colorInput.value = e.color;
    colorInput.dataset.field = 'color';

    // Icon button
    const iconBtn = document.createElement('button');
    iconBtn.className = 'endeavor-icon-btn';
    iconBtn.textContent = e.icon;
    iconBtn.dataset.field = 'icon';
    iconBtn.type = 'button';

    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'endeavor-name';
    nameInput.value = e.label;
    nameInput.dataset.field = 'label';
    nameInput.placeholder = 'Endeavor name';

    row.appendChild(colorInput);
    row.appendChild(iconBtn);
    row.appendChild(nameInput);

    // Platforms
    const platsDiv = document.createElement('div');
    platsDiv.className = 'endeavor-platforms';
    ['instagram', 'tiktok', 'twitch'].forEach(p => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = p;
      cb.checked = e.platforms.includes(p);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(p === 'instagram' ? 'IG' : p === 'tiktok' ? 'TT' : 'TW'));
      platsDiv.appendChild(label);
    });
    row.appendChild(platsDiv);

    endeavorsList.appendChild(row);

    // Icon picker dropdown
    const picker = document.createElement('div');
    picker.className = 'icon-picker';
    ICON_PRESETS.forEach(icon => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'icon-option';
      if (icon === e.icon) opt.classList.add('selected');
      opt.textContent = icon;
      opt.addEventListener('click', () => {
        iconBtn.textContent = icon;
        picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        picker.classList.remove('open');
      });
      picker.appendChild(opt);
    });
    endeavorsList.appendChild(picker);

    iconBtn.addEventListener('click', () => {
      // Close other pickers
      document.querySelectorAll('.icon-picker.open').forEach(p => p.classList.remove('open'));
      picker.classList.toggle('open');
    });
  });
}

async function handleSaveSettings() {
  const rows = endeavorsList.querySelectorAll('.endeavor-row');
  const pickers = endeavorsList.querySelectorAll('.icon-picker');
  const updated = [];

  rows.forEach((row, idx) => {
    const color = row.querySelector('[data-field="color"]').value;
    const icon = row.querySelector('[data-field="icon"]').textContent;
    const label = row.querySelector('[data-field="label"]').value.trim() || `Endeavor ${idx + 1}`;
    const platforms = [];
    row.querySelectorAll('.endeavor-platforms input:checked').forEach(cb => platforms.push(cb.value));

    updated.push({
      key: `endeavor_${idx + 1}`,
      label,
      icon,
      color,
      platforms
    });
  });

  await saveSettings({ endeavors: updated });
  closeSettings();
}
