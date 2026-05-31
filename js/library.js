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

const TYPE_LABELS = {
  post: 'Post',
  reel: 'Reel',
  carousel: 'Carousel',
  profile: 'Profile',
  story: 'Story',
  video: 'Video',
  other: 'Other'
};

const REVIEW_FIELDS = [
  { key: 'hook', label: 'Hook' },
  { key: 'format', label: 'Format' },
  { key: 'visual', label: 'Visual' },
  { key: 'tone', label: 'Tone' },
  { key: 'cta', label: 'CTA' },
  { key: 'why', label: 'Why it works' }
];

export function detectPlatform(url) {
  if (!url) return 'other';
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return 'other';
}

// Guess type from URL patterns (Instagram-focused for now)
function guessType(url) {
  if (!url) return 'post';
  const u = url.toLowerCase();
  if (/instagram\.com\/reel/.test(u) || /tiktok\.com\/.+\/video/.test(u)) return 'reel';
  if (/img_index=/.test(u)) return 'carousel';
  if (/instagram\.com\/p\//.test(u)) return 'post';
  if (/instagram\.com\/stories/.test(u)) return 'story';
  if (/youtube\.com\/watch|youtu\.be/.test(u)) return 'video';
  // Profile URL pattern: instagram.com/<handle>/ with no extra path
  if (/^https?:\/\/(www\.)?instagram\.com\/[^/]+\/?$/.test(url)) return 'profile';
  return 'post';
}

function extractImgIndex(url) {
  const m = String(url || '').match(/[?&]img_index=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

let items = [];
let editingDocId = null;
let unsubscribe = null;
let readOnly = false;

// DOM refs
let listEl, emptyEl;
let filterCategory, filterDoability, filterSearch, filterType;
let backdrop, urlInput, titleInput, categoryInput, notesInput, typeInput, imgIndexInput, imgIndexWrap;
let soloCb, plusOneCb, aiCb, platformBadge, headingEl, deleteBtn;
let reviewInputs = {};
let reviewCountEl;

export function initLibrary({ readOnly: ro }) {
  readOnly = !!ro;

  listEl = document.getElementById('library-list');
  emptyEl = document.getElementById('library-empty');
  filterCategory = document.getElementById('filter-category');
  filterDoability = document.getElementById('filter-doability');
  filterSearch = document.getElementById('filter-search');
  filterType = document.getElementById('filter-type');

  backdrop = document.getElementById('library-backdrop');
  urlInput = document.getElementById('lib-url');
  titleInput = document.getElementById('lib-title');
  categoryInput = document.getElementById('lib-category');
  notesInput = document.getElementById('lib-notes');
  typeInput = document.getElementById('lib-type');
  imgIndexInput = document.getElementById('lib-img-index');
  imgIndexWrap = document.getElementById('lib-img-index-wrap');
  soloCb = document.getElementById('lib-doability-solo');
  plusOneCb = document.getElementById('lib-doability-plusone');
  aiCb = document.getElementById('lib-doability-ai');
  platformBadge = document.getElementById('lib-platform-badge');
  headingEl = document.getElementById('library-modal-heading');
  deleteBtn = document.getElementById('library-delete');
  reviewCountEl = document.getElementById('lib-review-count');

  reviewInputs = {};
  REVIEW_FIELDS.forEach(f => {
    reviewInputs[f.key] = document.getElementById(`lib-rev-${f.key}`);
  });

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
    const raw = urlInput.value.trim();
    const p = detectPlatform(raw);
    if (raw) {
      platformBadge.textContent = `Detected: ${PLATFORM_ICONS[p]} ${PLATFORM_LABELS[p]}`;
      platformBadge.classList.add('detected');
      // Auto-suggest type only when adding new (not editing) and type still default
      if (!editingDocId) {
        const guess = guessType(raw);
        typeInput.value = guess;
        updateImgIndexVisibility();
        const idx = extractImgIndex(raw);
        if (idx) imgIndexInput.value = idx;
      }
    } else {
      platformBadge.textContent = '';
      platformBadge.classList.remove('detected');
    }
  });

  typeInput.addEventListener('change', updateImgIndexVisibility);

  Object.values(reviewInputs).forEach(el => {
    el.addEventListener('input', updateReviewCount);
  });

  [filterCategory, filterDoability, filterType].forEach(el => el && el.addEventListener('change', renderList));
  filterSearch.addEventListener('input', renderList);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) closeModal();
  });
}

function updateImgIndexVisibility() {
  imgIndexWrap.style.display = typeInput.value === 'carousel' ? '' : 'none';
}

function updateReviewCount() {
  const filled = REVIEW_FIELDS.filter(f => reviewInputs[f.key].value.trim()).length;
  reviewCountEl.textContent = filled > 0 ? `${filled}/${REVIEW_FIELDS.length} filled` : '';
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
  const type = filterType ? filterType.value : '';
  const search = filterSearch.value.trim().toLowerCase();

  const filtered = items.filter(it => {
    if (cat && it.category !== cat) return false;
    if (type && (it.type || 'post') !== type) return false;
    if (doa && !(it.doability && it.doability[doa])) return false;
    if (search) {
      const review = it.review || {};
      const hay = [
        it.title, it.notes, it.category, it.url,
        review.hook, review.format, review.visual, review.tone, review.cta, review.why
      ].filter(Boolean).join(' ').toLowerCase();
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

  // Group by category — items without category go to "Uncategorized"
  const groups = new Map();
  filtered.forEach(it => {
    const key = it.category || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });

  // Sort group keys: named categories alphabetically, "—" last
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach(key => {
    const section = document.createElement('section');
    section.className = 'library-group';

    const heading = document.createElement('h3');
    heading.className = 'library-group-heading';
    heading.innerHTML = `<span class="library-group-name">${key === '—' ? 'Uncategorized' : escapeHtml(key)}</span><span class="library-group-count">${groups.get(key).length}</span>`;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'library-group-grid';
    groups.get(key).forEach(it => grid.appendChild(renderCard(it)));
    section.appendChild(grid);

    listEl.appendChild(section);
  });
}

function renderCard(item) {
  const card = document.createElement('div');
  card.className = 'library-card';

  const top = document.createElement('div');
  top.className = 'library-card-top';

  const platform = item.platform || detectPlatform(item.url);
  const type = item.type || 'post';
  const badges = document.createElement('div');
  badges.className = 'library-card-badges';

  const plat = document.createElement('span');
  plat.className = `library-platform platform-${platform}`;
  plat.innerHTML = `<span>${PLATFORM_ICONS[platform]}</span> ${PLATFORM_LABELS[platform]}`;
  badges.appendChild(plat);

  const typeBadge = document.createElement('span');
  typeBadge.className = `library-type-badge type-${type}`;
  typeBadge.textContent = TYPE_LABELS[type] || type;
  if (type === 'carousel' && item.imgIndex) typeBadge.textContent += ` · img ${item.imgIndex}`;
  badges.appendChild(typeBadge);

  top.appendChild(badges);

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

  // Review summary — show filled review fields
  const review = item.review || {};
  const filledReviews = REVIEW_FIELDS.filter(f => review[f.key]);
  if (filledReviews.length > 0) {
    const reviewWrap = document.createElement('div');
    reviewWrap.className = 'library-card-review';
    filledReviews.forEach(f => {
      const row = document.createElement('div');
      row.className = 'library-card-review-row';
      const label = document.createElement('span');
      label.className = 'library-card-review-label';
      label.textContent = f.label;
      const val = document.createElement('span');
      val.className = 'library-card-review-value';
      val.textContent = review[f.key];
      row.appendChild(label);
      row.appendChild(val);
      reviewWrap.appendChild(row);
    });
    card.appendChild(reviewWrap);
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
  typeInput.value = item ? (item.type || 'post') : 'post';
  imgIndexInput.value = item && item.imgIndex ? item.imgIndex : '';
  updateImgIndexVisibility();

  const d = item ? (item.doability || {}) : {};
  soloCb.checked = !!d.solo;
  plusOneCb.checked = !!d.plusOne;
  aiCb.checked = !!d.ai;

  const r = item ? (item.review || {}) : {};
  REVIEW_FIELDS.forEach(f => {
    reviewInputs[f.key].value = r[f.key] || '';
  });
  updateReviewCount();

  // Open review section if any field is filled
  const reviewSection = document.getElementById('lib-review-section');
  reviewSection.open = REVIEW_FIELDS.some(f => r[f.key]);

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

  const review = {};
  REVIEW_FIELDS.forEach(f => {
    const v = reviewInputs[f.key].value.trim();
    if (v) review[f.key] = v;
  });

  const data = {
    url,
    platform: detectPlatform(url),
    type: typeInput.value || 'post',
    title: titleInput.value.trim(),
    category: categoryInput.value.trim(),
    notes: notesInput.value.trim(),
    doability: {
      solo: soloCb.checked,
      plusOne: plusOneCb.checked,
      ai: aiCb.checked
    },
    review
  };

  if (typeInput.value === 'carousel' && imgIndexInput.value) {
    const idx = parseInt(imgIndexInput.value, 10);
    if (!isNaN(idx) && idx > 0) data.imgIndex = idx;
  }

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
