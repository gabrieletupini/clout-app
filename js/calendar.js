// Default endeavors (used until settings are loaded from Firestore)
export const DEFAULT_ENDEAVORS = [
  { key: 'endeavor_1', label: 'Music Video', icon: '\uD83C\uDFB5', color: '#c0392b', platforms: ['instagram', 'tiktok'] },
  { key: 'endeavor_2', label: 'Live Stream', icon: '\u2694\uFE0F', color: '#8e44ad', platforms: ['tiktok', 'twitch'] },
  { key: 'endeavor_3', label: 'Humor Skit', icon: '\uD83E\uDD39', color: '#27ae60', platforms: ['instagram', 'tiktok'] }
];

// Icon presets for the settings picker
export const ICON_PRESETS = [
  '\uD83C\uDFB5', '\u2694\uFE0F', '\uD83E\uDD39', '\uD83D\uDCDC', '\uD83D\uDEE1\uFE0F',
  '\uD83D\uDC51', '\uD83E\uDDEA', '\uD83C\uDFF9', '\uD83C\uDFAE', '\uD83C\uDFA4',
  '\uD83C\uDFA5', '\uD83D\uDD25', '\uD83C\uDF1F', '\uD83D\uDCA1', '\uD83C\uDFAD'
];

const PLATFORM_LABELS = { instagram: 'IG', tiktok: 'TT', twitch: 'TW' };

// Build a lookup map from endeavors array
export function endeavorMap(endeavors) {
  const map = {};
  endeavors.forEach(e => { map[e.key] = e; });
  return map;
}

// Deterministic content type suggestion based on day-of-year
export function suggestedContentType(dateString, endeavors) {
  const d = new Date(dateString + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / 86400000);
  return endeavors[dayOfYear % endeavors.length].key;
}

// Compute weekly progress for the quest path
// Returns array of { weekNum, completed, total, hasGold }
export function computeWeeklyProgress(year, month, daysMap) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const weeks = [];
  let weekStart = 1;

  // First partial week (if month doesn't start on Sunday)
  if (firstDay > 0) {
    const firstWeekEnd = Math.min(7 - firstDay, totalDays);
    const w = countDone(year, month, weekStart, firstWeekEnd, daysMap);
    weeks.push({ weekNum: 1, ...w, total: firstWeekEnd - weekStart + 1 });
    weekStart = firstWeekEnd + 1;
  }

  // Full weeks
  while (weekStart <= totalDays) {
    const weekEnd = Math.min(weekStart + 6, totalDays);
    const daysInWeek = weekEnd - weekStart + 1;
    const w = countDone(year, month, weekStart, weekEnd, daysMap);
    weeks.push({ weekNum: weeks.length + 1, ...w, total: daysInWeek });
    weekStart = weekEnd + 1;
  }

  return weeks;
}

function countDone(year, month, start, end, daysMap) {
  let completed = 0;
  for (let d = start; d <= end; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = daysMap.get(dateStr);
    if (data && data.done) completed++;
  }
  return { completed };
}

// Render the full calendar grid
export function renderCalendar(container, year, month, daysMap, endeavors, handlers) {
  container.innerHTML = '';
  const eMap = endeavorMap(endeavors);

  const firstDay = new Date(year, month - 1, 1).getDay();
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

    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    const dayData = daysMap.get(dateStr);

    if (dayData) {
      cell.appendChild(createCard(dayData, false, eMap));
    } else {
      const sugKey = suggestedContentType(dateStr, endeavors);
      const sug = eMap[sugKey];
      cell.appendChild(createCard({
        contentType: sugKey,
        title: '',
        platforms: sug ? sug.platforms : [],
        done: false
      }, true, eMap));
    }

    cell.addEventListener('click', (e) => {
      if (e.target.classList.contains('done-check')) return;
      handlers.onDayClick(dateStr, dayData || null);
    });

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

  // Trailing empty cells
  const totalCells = firstDay + totalDays;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailing; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }
}

function createCard(data, isSuggested, eMap) {
  const endeavor = eMap[data.contentType] || eMap[Object.keys(eMap)[0]];
  const card = document.createElement('div');
  card.className = 'day-card';
  card.style.setProperty('--type-color', endeavor ? endeavor.color : '#666');

  if (isSuggested) {
    card.classList.add('suggested');
  } else {
    card.draggable = true;
    card.dataset.docId = data.docId;
    if (data.done) card.classList.add('done');

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', data.docId);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  const header = document.createElement('div');
  header.className = 'card-header';

  const badge = document.createElement('span');
  badge.className = 'content-type-badge';
  badge.style.setProperty('--type-color', endeavor ? endeavor.color : '#666');
  badge.textContent = endeavor ? `${endeavor.icon} ${endeavor.label}` : data.contentType;
  header.appendChild(badge);

  if (!isSuggested) {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'done-check';
    check.checked = !!data.done;
    check.addEventListener('click', (e) => e.stopPropagation());
    check.addEventListener('change', (e) => {
      e.stopPropagation();
      card.dispatchEvent(new CustomEvent('toggle-done', {
        bubbles: true,
        detail: { docId: data.docId, done: check.checked }
      }));
    });
    header.appendChild(check);
  }

  card.appendChild(header);

  if (data.title) {
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = data.title;
    card.appendChild(title);
  }

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
