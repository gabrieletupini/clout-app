import { initFirebase, subscribeToMonth, createDay, updateDay, deleteDay, moveDayToDate } from './firebase.js';
import { renderCalendar, CONTENT_TYPES, suggestedContentType } from './calendar.js';

// ===== State =====
let currentYear, currentMonth;
let unsubscribe = null;
let currentDaysMap = new Map();

// ===== DOM refs =====
const grid = document.getElementById('calendar-grid');
const monthLabel = document.getElementById('month-label');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const backdrop = document.getElementById('modal-backdrop');
const modalDate = document.getElementById('modal-date');
const modalTitle = document.getElementById('modal-title');
const modalNotes = document.getElementById('modal-notes');
const modalDone = document.getElementById('modal-done');
const modalSave = document.getElementById('modal-save');
const modalDelete = document.getElementById('modal-delete');
const modalClose = document.getElementById('modal-close');
const typeButtons = document.querySelectorAll('.type-btn');
const platInstagram = document.getElementById('plat-instagram');
const platTiktok = document.getElementById('plat-tiktok');
const platTwitch = document.getElementById('plat-twitch');

// Currently editing
let editingDate = null;
let editingDocId = null;

// ===== Month names =====
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1; // 1-indexed

  loadMonth();
  wireEvents();
});

function loadMonth() {
  monthLabel.textContent = `${MONTHS[currentMonth - 1]} ${currentYear}`;

  // Unsubscribe from previous listener
  if (unsubscribe) unsubscribe();

  unsubscribe = subscribeToMonth(currentYear, currentMonth, (daysMap) => {
    currentDaysMap = daysMap;
    renderCalendar(grid, currentYear, currentMonth, daysMap, {
      onDayClick: openModal,
      onDrop: handleDrop,
    });
  });
}

function wireEvents() {
  // Month navigation
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

  // Modal close
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Type selector buttons
  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Auto-set default platforms for this type
      const typeKey = btn.dataset.type;
      const defaults = CONTENT_TYPES[typeKey].platforms;
      platInstagram.checked = defaults.includes('instagram');
      platTiktok.checked = defaults.includes('tiktok');
      platTwitch.checked = defaults.includes('twitch');
    });
  });

  // Save
  modalSave.addEventListener('click', handleSave);

  // Delete
  modalDelete.addEventListener('click', handleDelete);

  // Checkbox toggle via event delegation
  grid.addEventListener('toggle-done', async (e) => {
    const { docId, done } = e.detail;
    if (docId) {
      await updateDay(docId, { done });
    }
  });
}

// ===== Modal =====
function openModal(dateStr, dayData) {
  editingDate = dateStr;
  editingDocId = dayData ? dayData.docId : null;

  // Format date display
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = d.toLocaleDateString('en-US', { month: 'long' });
  modalDate.textContent = `${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()}`;

  if (dayData) {
    // Existing entry
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
    // New entry — use auto-rotation suggestion
    const suggested = suggestedContentType(dateStr);
    selectType(suggested);
    modalTitle.value = '';
    modalNotes.value = '';
    modalDone.checked = false;
    const defaults = CONTENT_TYPES[suggested].platforms;
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
  typeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === typeKey);
  });
}

function getSelectedType() {
  const active = document.querySelector('.type-btn.active');
  return active ? active.dataset.type : 'music_video';
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
  if (editingDocId) {
    await deleteDay(editingDocId);
  }
  closeModal();
}

async function handleDrop(docId, newDate) {
  if (docId && newDate) {
    await moveDayToDate(docId, newDate);
  }
}
