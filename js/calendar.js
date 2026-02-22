// Content type definitions
export const CONTENT_TYPES = {
  music_video: { label: 'Music Video', color: '#e74c3c', icon: '🎵', platforms: ['instagram', 'tiktok'] },
  live_stream: { label: 'Live Stream', color: '#9b59b6', icon: '🎮', platforms: ['tiktok', 'twitch'] },
  humor_skit: { label: 'Humor Skit', color: '#2ecc71', icon: '😂', platforms: ['instagram', 'tiktok'] }
};

const TYPE_ORDER = ['music_video', 'live_stream', 'humor_skit'];

const PLATFORM_LABELS = { instagram: 'IG', tiktok: 'TT', twitch: 'TW' };

// Deterministic content type suggestion based on day-of-year
export function suggestedContentType(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / 86400000);
  return TYPE_ORDER[dayOfYear % 3];
}

// Render the full calendar grid
export function renderCalendar(container, year, month, daysMap, handlers) {
  container.innerHTML = '';

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dateStr;
    if (dateStr === todayStr) cell.classList.add('today');

    // Day number
    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    const dayData = daysMap.get(dateStr);

    if (dayData) {
      cell.appendChild(createCard(dayData, false));
    } else {
      // Show suggested card
      const suggestedType = suggestedContentType(dateStr);
      cell.appendChild(createCard({
        contentType: suggestedType,
        title: '',
        platforms: CONTENT_TYPES[suggestedType].platforms,
        done: false
      }, true));
    }

    // Click handler — open modal
    cell.addEventListener('click', (e) => {
      // Don't open modal if clicking checkbox
      if (e.target.classList.contains('done-check')) return;
      handlers.onDayClick(dateStr, dayData || null);
    });

    // Drag-drop target handlers
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => {
      cell.classList.remove('drag-over');
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const docId = e.dataTransfer.getData('text/plain');
      if (docId) handlers.onDrop(docId, dateStr);
    });

    container.appendChild(cell);
  }

  // Trailing empty cells to complete the row
  const totalCells = firstDay + totalDays;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailing; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }
}

function createCard(data, isSuggested) {
  const type = CONTENT_TYPES[data.contentType] || CONTENT_TYPES.music_video;
  const card = document.createElement('div');
  card.className = 'day-card';
  card.style.setProperty('--type-color', type.color);

  if (isSuggested) {
    card.classList.add('suggested');
  } else {
    // Only real cards are draggable
    card.draggable = true;
    card.dataset.docId = data.docId;
    if (data.done) card.classList.add('done');

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', data.docId);
      card.classList.add('dragging');
      // Needed so the drag image works
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  // Header: badge + checkbox
  const header = document.createElement('div');
  header.className = 'card-header';

  const badge = document.createElement('span');
  badge.className = 'content-type-badge';
  badge.style.setProperty('--type-color', type.color);
  badge.textContent = `${type.icon} ${type.label}`;
  header.appendChild(badge);

  if (!isSuggested) {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'done-check';
    check.checked = !!data.done;
    check.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    check.addEventListener('change', (e) => {
      e.stopPropagation();
      // Dispatch custom event for app.js to handle
      card.dispatchEvent(new CustomEvent('toggle-done', {
        bubbles: true,
        detail: { docId: data.docId, done: check.checked }
      }));
    });
    header.appendChild(check);
  }

  card.appendChild(header);

  // Title
  if (data.title) {
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = data.title;
    card.appendChild(title);
  }

  // Platform tags
  const platforms = data.platforms || [];
  if (platforms.length > 0 && !isSuggested) {
    const tags = document.createElement('div');
    tags.className = 'platform-tags';
    platforms.forEach((p) => {
      const tag = document.createElement('span');
      tag.className = `tag tag-${p}`;
      tag.textContent = PLATFORM_LABELS[p] || p;
      tags.appendChild(tag);
    });
    card.appendChild(tags);
  }

  return card;
}
