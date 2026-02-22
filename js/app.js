import {
  initFirebase, subscribeToMonth, createDay, updateDay, deleteDay,
  moveDayToDate, saveSettings, subscribeToSettings, onSyncStatus
} from './firebase.js';
import {
  renderCalendar, computeWeeklyProgress,
  DEFAULT_ENDEAVORS, ICON_PRESETS, endeavorMap
} from './calendar.js';

// ===== State =====
let currentYear, currentMonth;
let unsubMonth = null;
let unsubSettings = null;
let currentDaysMap = new Map();
let endeavors = [...DEFAULT_ENDEAVORS];
let settingsInitialized = false;

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

// Settings
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

// Tip
const tipBanner = document.getElementById('tip-banner');
const tipClose = document.getElementById('tip-close');

// Sync
const syncIndicator = document.getElementById('sync-indicator');
const syncLabel = document.getElementById('sync-label');

let editingDate = null;
let editingDocId = null;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  // Wire sync status
  let connected = false;
  onSyncStatus((status) => {
    connected = true;
    syncIndicator.className = 'sync-indicator';
    if (status === 'synced') {
      syncIndicator.classList.add('synced');
      syncLabel.textContent = 'Synced';
    } else if (status === 'error') {
      syncIndicator.classList.add('error');
      syncLabel.textContent = 'Offline';
    } else {
      syncLabel.textContent = 'Saving...';
    }
  });

  // Connection timeout — if no response in 8s, show error
  setTimeout(() => {
    if (!connected) {
      syncIndicator.classList.add('error');
      syncLabel.textContent = 'Connection failed';
    }
  }, 8000);

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  if (localStorage.getItem('clout-tip-dismissed')) {
    tipBanner.style.display = 'none';
  }

  unsubSettings = subscribeToSettings(async (data) => {
    if (data && data.endeavors && data.endeavors.length === 3) {
      endeavors = data.endeavors;
    } else if (!settingsInitialized) {
      // First time — save defaults to Firestore so they're editable
      endeavors = [...DEFAULT_ENDEAVORS];
      try { await saveSettings({ endeavors }); } catch (e) { console.error('Failed to save defaults:', e); }
    } else {
      endeavors = [...DEFAULT_ENDEAVORS];
    }
    settingsInitialized = true;
    renderLegend();
    rebuildTypeSelector();
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
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = e.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(` ${e.icon} ${e.label}`));
    legend.appendChild(item);
  });
}

// ===== Type Selector =====
function rebuildTypeSelector() {
  modalType.innerHTML = '';
  endeavors.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'type-btn';
    btn.type = 'button';
    btn.dataset.type = e.key;
    btn.style.setProperty('--type-color', e.color);
    btn.textContent = `${e.icon} ${e.label}`;
    btn.addEventListener('click', () => {
      modalType.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      platInstagram.checked = e.platforms.includes('instagram');
      platTiktok.checked = e.platforms.includes('tiktok');
      platTwitch.checked = e.platforms.includes('twitch');
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

    const threshold = Math.ceil(w.total / 2);
    const isCompleted = w.completed >= threshold;
    const isGold = w.completed >= w.total && w.total > 0;

    if (isCompleted) { cp.classList.add('completed'); completedWeeks++; }
    if (isGold) { cp.classList.add('has-gold'); goldCoins++; }

    const coinDiv = document.createElement('div');
    coinDiv.className = 'checkpoint-coin';
    cp.appendChild(coinDiv);

    const node = document.createElement('div');
    node.className = 'checkpoint-node';
    node.title = `Week ${i + 1}: ${w.completed}/${w.total} done`;
    cp.appendChild(node);

    const label = document.createElement('span');
    label.className = 'checkpoint-label';
    label.textContent = `Wk${i + 1}`;
    cp.appendChild(label);

    checkpointsEl.appendChild(cp);
  });

  goldCountEl.textContent = goldCoins;

  requestAnimationFrame(() => {
    const totalCp = weeks.length;
    if (totalCp > 0) {
      const pathWidth = checkpointsEl.offsetWidth;
      const progress = completedWeeks / totalCp;
      questAvatar.style.left = (progress * (pathWidth - 40) + 4) + 'px';
      pathFill.style.width = (progress * (pathWidth - 40)) + 'px';
    }
  });
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

  tipClose.addEventListener('click', () => {
    tipBanner.style.display = 'none';
    localStorage.setItem('clout-tip-dismissed', '1');
  });

  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  modalSave.addEventListener('click', handleSave);
  modalDelete.addEventListener('click', handleDelete);

  settingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', (e) => { if (e.target === settingsBackdrop) closeSettings(); });
  settingsSave.addEventListener('click', handleSaveSettings);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeSettings(); }
  });

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
    modalType.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    const first = modalType.querySelector('.type-btn');
    if (first) first.classList.add('active');
    modalTitle.value = '';
    modalNotes.value = '';
    modalDone.checked = false;
    platInstagram.checked = false;
    platTiktok.checked = false;
    platTwitch.checked = false;
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
    const card = document.createElement('div');
    card.className = 'endeavor-card';
    card.style.setProperty('--endeavor-color', e.color);

    // Header row: number, icon, name, color
    const header = document.createElement('div');
    header.className = 'endeavor-card-header';

    const num = document.createElement('span');
    num.className = 'endeavor-number';
    num.textContent = idx + 1;

    const iconBtn = document.createElement('button');
    iconBtn.className = 'endeavor-icon-btn';
    iconBtn.textContent = e.icon;
    iconBtn.type = 'button';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'endeavor-name';
    nameInput.value = e.label;
    nameInput.placeholder = 'Endeavor name';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'endeavor-color';
    colorInput.value = e.color;
    colorInput.addEventListener('input', () => {
      card.style.setProperty('--endeavor-color', colorInput.value);
    });

    header.appendChild(num);
    header.appendChild(iconBtn);
    header.appendChild(nameInput);
    header.appendChild(colorInput);
    card.appendChild(header);

    // Body row: platforms + preview
    const body = document.createElement('div');
    body.className = 'endeavor-card-body';

    const platsDiv = document.createElement('div');
    platsDiv.className = 'endeavor-platforms';
    const platNames = { instagram: 'Instagram', tiktok: 'TikTok', twitch: 'Twitch' };
    ['instagram', 'tiktok', 'twitch'].forEach(p => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = p;
      cb.checked = e.platforms.includes(p);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(` ${platNames[p]}`));
      platsDiv.appendChild(label);
    });
    body.appendChild(platsDiv);

    const preview = document.createElement('span');
    preview.className = 'endeavor-preview';
    preview.textContent = 'Default platforms';
    body.appendChild(preview);
    card.appendChild(body);

    // Icon picker (inside the card)
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
    card.appendChild(picker);

    iconBtn.addEventListener('click', () => {
      document.querySelectorAll('.icon-picker.open').forEach(p => p.classList.remove('open'));
      picker.classList.toggle('open');
    });

    endeavorsList.appendChild(card);
  });
}

async function handleSaveSettings() {
  const rows = endeavorsList.querySelectorAll('.endeavor-card');
  const updated = [];

  rows.forEach((row, idx) => {
    const color = row.querySelector('.endeavor-color').value;
    const icon = row.querySelector('.endeavor-icon-btn').textContent;
    const label = row.querySelector('.endeavor-name').value.trim() || `Endeavor ${idx + 1}`;
    const platforms = [];
    row.querySelectorAll('.endeavor-platforms input:checked').forEach(cb => platforms.push(cb.value));

    updated.push({ key: `endeavor_${idx + 1}`, label, icon, color, platforms });
  });

  await saveSettings({ endeavors: updated });
  closeSettings();
}
