import {
  subscribeToLibrary, createLibraryItem, updateLibraryItem, deleteLibraryItem
} from './firebase.js';

const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  other: 'Link'
};

const PLATFORM_ICONS = {
  tiktok: '🎵',
  instagram: '📷',
  youtube: '▶️',
  other: '🔗'
};

export function detectPlatform(url) {
  if (!url) return 'other';
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return 'other';
}

let items = [];
let editingDocId = null;
let unsubscribe = null;
let readOnly = false;

// DOM refs (resolved on init)
let listEl, emptyEl;
let filterCategory, filterDoability, filterSearch;
let backdrop, urlInput, titleInput, categoryInput, notesInput;
let soloCb, plusOneCb, aiCb, platformBadge, headingEl, deleteBtn;

export function initLibrary({ readOnly: ro }) {
  readOnly = !!ro;

  listEl = document.getElementById('library-list');
  emptyEl = document.getElementById('library-empty');
  filterCategory = document.getElementById('filter-category');
  filterDoability = document.getElementById('filter-doability');
  filterSearch = document.getElementById('filter-search');

  backdrop = document.getElementById('library-backdrop');
  urlInput = document.getElementById('lib-url');
  titleInput = document.getElementById('lib-title');
  categoryInput = document.getElementById('lib-category');
  notesInput = document.getElementById('lib-notes');
  soloCb = document.getElementById('lib-doability-solo');
  plusOneCb = document.getElementById('lib-doability-plusone');
  aiCb = document.getElementById('lib-doability-ai');
  platformBadge = document.getElementById('lib-platform-badge');
  headingEl = document.getElementById('library-modal-heading');
  deleteBtn = document.getElementById('library-delete');

  wireEvents();

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToLibrary((newItems) => {
    items = newItems;
    refreshCategoryFilter();
    renderList();
  });
}

function wireEvents() {
  document.getElementById('library-add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('library-modal-close').addEventListener('click', closeModal);
  document.getElementById('library-save').addEventListener('click', handleSave);
  deleteBtn.addEventListener('click', handleDelete);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  urlInput.addEventListener('input', () => {
    const p = detectPlatform(urlInput.value.trim());
    if (urlInput.value.trim()) {
      platformBadge.textContent = `Detected: ${PLATFORM_ICONS[p]} ${PLATFORM_LABELS[p]}`;
      platformBadge.classList.add('detected');
    } else {
      platformBadge.textContent = '';
      platformBadge.classList.remove('detected');
    }
  });

  [filterCategory, filterDoability].forEach(el => el.addEventListener('change', renderList));
  filterSearch.addEventListener('input', renderList);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) closeModal();
  });
}

function refreshCategoryFilter() {
  const cats = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort();
  const current = filterCategory.value;
  filterCategory.innerHTML = '<option value="">All</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (cats.includes(current)) filterCategory.value = current;
}

function renderList() {
  const cat = filterCategory.value;
  const doa = filterDoability.value;
  const search = filterSearch.value.trim().toLowerCase();

  const filtered = items.filter(it => {
    if (cat && it.category !== cat) return false;
    if (doa && !(it.doability && it.doability[doa])) return false;
    if (search) {
      const hay = `${it.title || ''} ${it.notes || ''} ${it.category || ''} ${it.url || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  listEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
    if (items.length > 0) {
      emptyEl.querySelector('p').textContent = 'No matches for current filters.';
      emptyEl.querySelector('.library-empty-hint').textContent = 'Try clearing filters above.';
    } else {
      emptyEl.querySelector('p').textContent = 'No references yet.';
      emptyEl.querySelector('.library-empty-hint').innerHTML = 'Click <strong>Add Reference</strong> to paste your first reel or TikTok link.';
    }
    return;
  }

  emptyEl.classList.add('hidden');
  filtered.forEach(it => listEl.appendChild(renderCard(it)));
}

function renderCard(item) {
  const card = document.createElement('div');
  card.className = 'library-card';

  const top = document.createElement('div');
  top.className = 'library-card-top';

  const platform = item.platform || detectPlatform(item.url);
  const plat = document.createElement('span');
  plat.className = `library-platform platform-${platform}`;
  plat.innerHTML = `<span>${PLATFORM_ICONS[platform]}</span> ${PLATFORM_LABELS[platform]}`;
  top.appendChild(plat);

  const actions = document.createElement('div');
  actions.className = 'library-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'library-icon-btn';
  editBtn.type = 'button';
  editBtn.title = 'Edit';
  editBtn.innerHTML = '&#9998;';
  editBtn.addEventListener('click', () => openModal(item));
  actions.appendChild(editBtn);

  top.appendChild(actions);
  card.appendChild(top);

  if (item.title) {
    const title = document.createElement('div');
    title.className = 'library-card-title';
    title.textContent = item.title;
    card.appendChild(title);
  }

  if (item.category) {
    const cat = document.createElement('div');
    cat.className = 'library-card-category';
    cat.textContent = item.category;
    card.appendChild(cat);
  }

  const doability = item.doability || {};
  const tags = [];
  if (doability.solo) tags.push({ key: 'solo', icon: '👨', label: 'Solo' });
  if (doability.plusOne) tags.push({ key: 'plusone', icon: '👥', label: '+1' });
  if (doability.ai) tags.push({ key: 'ai', icon: '🤖', label: 'AI' });

  if (tags.length > 0) {
    const doaWrap = document.createElement('div');
    doaWrap.className = 'library-card-doability';
    tags.forEach(t => {
      const tag = document.createElement('span');
      tag.className = `doability-tag tag-${t.key}`;
      tag.innerHTML = `${t.icon} ${t.label}`;
      doaWrap.appendChild(tag);
    });
    card.appendChild(doaWrap);
  }

  if (item.notes) {
    const notes = document.createElement('div');
    notes.className = 'library-card-notes';
    notes.textContent = item.notes;
    card.appendChild(notes);
  }

  if (item.url) {
    const link = document.createElement('a');
    link.className = 'library-card-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = shortenUrl(item.url);
    card.appendChild(link);
  }

  return card;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 30) + '...' : u.pathname;
    return u.host + path;
  } catch {
    return url.length > 50 ? url.slice(0, 50) + '...' : url;
  }
}

function openModal(item) {
  if (readOnly) return;
  editingDocId = item ? item.docId : null;

  headingEl.textContent = item ? 'Edit Reference' : 'Add Reference';
  urlInput.value = item ? (item.url || '') : '';
  titleInput.value = item ? (item.title || '') : '';
  categoryInput.value = item ? (item.category || '') : '';
  notesInput.value = item ? (item.notes || '') : '';
  const d = item ? (item.doability || {}) : {};
  soloCb.checked = !!d.solo;
  plusOneCb.checked = !!d.plusOne;
  aiCb.checked = !!d.ai;

  urlInput.dispatchEvent(new Event('input'));
  deleteBtn.style.display = item ? '' : 'none';

  backdrop.classList.remove('hidden');
  setTimeout(() => urlInput.focus(), 50);
}

function closeModal() {
  backdrop.classList.add('hidden');
  editingDocId = null;
}

async function handleSave() {
  if (readOnly) return;
  const url = urlInput.value.trim();
  if (!url) {
    urlInput.focus();
    urlInput.style.borderColor = '#da3633';
    setTimeout(() => { urlInput.style.borderColor = ''; }, 1500);
    return;
  }

  const data = {
    url,
    platform: detectPlatform(url),
    title: titleInput.value.trim(),
    category: categoryInput.value.trim(),
    notes: notesInput.value.trim(),
    doability: {
      solo: soloCb.checked,
      plusOne: plusOneCb.checked,
      ai: aiCb.checked
    }
  };

  if (editingDocId) {
    await updateLibraryItem(editingDocId, data);
  } else {
    await createLibraryItem(data);
  }
  closeModal();
}

async function handleDelete() {
  if (readOnly || !editingDocId) return;
  if (!confirm('Delete this reference?')) return;
  await deleteLibraryItem(editingDocId);
  closeModal();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
