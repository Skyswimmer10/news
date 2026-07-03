'use strict';

// Renderer logic. All persistence and network work happens in the main
// process; this file only renders state and forwards user actions.

let topics = [];
let items = [];
let settings = {};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------- Navigation ----------

$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $(`#view-${btn.dataset.view}`).classList.remove('hidden');
  });
});

// ---------- Data loading ----------

async function refreshAll() {
  [topics, items, settings] = await Promise.all([
    window.api.listTopics(),
    window.api.listItems(),
    window.api.getSettings()
  ]);
  renderTopicFilter();
  renderFeed();
  renderSaved();
  renderTopics();
  renderSettings();
  renderUnreadBadge();
}

function topicName(id) {
  const t = topics.find((t) => t.id === id);
  return t ? t.name : '(deleted topic)';
}

function renderUnreadBadge() {
  const unread = items.filter((i) => !i.seen).length;
  const badge = $('#unread-badge');
  badge.textContent = unread;
  badge.classList.toggle('hidden', unread === 0);
}

// ---------- Feed ----------

function renderTopicFilter() {
  const sel = $('#filter-topic');
  const current = sel.value;
  sel.innerHTML = '<option value="">All topics</option>';
  for (const t of topics) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function itemCard(item) {
  const card = document.createElement('div');
  card.className = `item-card ${item.seen ? 'seen' : 'unread'}`;

  if (item.thumbnail) {
    const img = document.createElement('img');
    img.className = 'item-thumb';
    img.src = item.thumbnail;
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'item-body';

  const title = document.createElement('a');
  title.className = 'item-title';
  title.textContent = item.title;
  title.href = '#';
  title.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal(item.url);
    if (!item.seen) {
      item.seen = true;
      window.api.markSeen([item.id]);
      card.classList.replace('unread', 'seen');
      renderUnreadBadge();
    }
  });
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'item-meta';
  const chip = document.createElement('span');
  chip.className = `type-chip type-${item.type}`;
  chip.textContent = item.type;
  meta.appendChild(chip);
  const metaText = document.createElement('span');
  const date = new Date(item.publishedAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  metaText.textContent = [item.source, date, topicName(item.topicId)].filter(Boolean).join(' · ');
  meta.appendChild(metaText);
  body.appendChild(meta);

  if (item.description) {
    const desc = document.createElement('div');
    desc.className = 'item-desc';
    desc.textContent = item.description;
    body.appendChild(desc);
  }
  card.appendChild(body);

  const saveBtn = document.createElement('button');
  saveBtn.className = `save-btn ${item.saved ? 'saved' : ''}`;
  saveBtn.textContent = item.saved ? '★' : '☆';
  saveBtn.title = item.saved ? 'Remove from saved' : 'Save for later';
  saveBtn.addEventListener('click', async () => {
    item.saved = await window.api.toggleSaved(item.id);
    saveBtn.textContent = item.saved ? '★' : '☆';
    saveBtn.classList.toggle('saved', item.saved);
    renderSaved();
  });
  card.appendChild(saveBtn);

  return card;
}

function renderFeed() {
  const list = $('#feed-list');
  list.innerHTML = '';
  const topicFilter = $('#filter-topic').value;
  const typeFilter = $('#filter-type').value;
  const unreadOnly = $('#filter-unread').checked;

  const visible = items.filter(
    (i) =>
      (!topicFilter || i.topicId === topicFilter) &&
      (!typeFilter || i.type === typeFilter) &&
      (!unreadOnly || !i.seen)
  );

  if (!visible.length) {
    const msg = document.createElement('p');
    msg.className = 'empty-msg';
    msg.textContent = topics.length
      ? 'Nothing here yet. Try “Fetch now”, or loosen the filters.'
      : 'No topics yet — add your first topic in the Topics tab.';
    list.appendChild(msg);
    return;
  }
  for (const item of visible.slice(0, 300)) list.appendChild(itemCard(item));
}

$('#filter-topic').addEventListener('change', renderFeed);
$('#filter-type').addEventListener('change', renderFeed);
$('#filter-unread').addEventListener('change', renderFeed);

$('#mark-all-seen').addEventListener('click', async () => {
  const unseen = items.filter((i) => !i.seen).map((i) => i.id);
  if (!unseen.length) return;
  await window.api.markSeen(unseen);
  items.forEach((i) => (i.seen = true));
  renderFeed();
  renderUnreadBadge();
});

// ---------- Saved ----------

function renderSaved() {
  const list = $('#saved-list');
  list.innerHTML = '';
  const saved = items.filter((i) => i.saved);
  if (!saved.length) {
    const msg = document.createElement('p');
    msg.className = 'empty-msg';
    msg.textContent = 'No saved items. Click the ☆ on any item to keep it here.';
    list.appendChild(msg);
    return;
  }
  for (const item of saved) list.appendChild(itemCard(item));
}

// ---------- Topics ----------

function topicStatus(t) {
  if (t.paused) return ['paused', 'Paused'];
  if (!t.active) return ['expired', 'Ended'];
  return ['active', 'Active'];
}

function renderTopics() {
  const list = $('#topic-list');
  list.innerHTML = '';
  if (!topics.length) {
    const msg = document.createElement('p');
    msg.className = 'empty-msg';
    msg.textContent = 'No topics yet. Add a permanent daily topic, or a temporary one with an end date.';
    list.appendChild(msg);
    return;
  }
  for (const t of topics) {
    const card = document.createElement('div');
    card.className = `topic-card ${t.active ? '' : 'inactive'}`;

    const info = document.createElement('div');
    info.className = 'topic-info';
    const name = document.createElement('span');
    name.className = 'topic-name';
    name.textContent = t.name;
    const [cls, label] = topicStatus(t);
    const status = document.createElement('span');
    status.className = `status-chip status-${cls}`;
    status.textContent = label;
    const details = document.createElement('div');
    details.className = 'topic-details';
    const parts = [`query: ${t.query}`, t.types.join(', ')];
    if (t.endDate) parts.push(`until ${t.endDate}`);
    details.textContent = parts.join(' · ');
    info.append(name, status, details);
    card.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'topic-actions';

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'secondary';
    pauseBtn.textContent = t.paused ? 'Resume' : 'Pause';
    pauseBtn.addEventListener('click', async () => {
      await window.api.saveTopic({ ...t, paused: !t.paused });
      refreshAll();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openTopicForm(t));

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (confirm(`Delete topic "${t.name}" and its unsaved items?`)) {
        await window.api.deleteTopic(t.id);
        refreshAll();
      }
    });

    actions.append(pauseBtn, editBtn, delBtn);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

function openTopicForm(topic) {
  $('#topic-form-wrap').classList.remove('hidden');
  $('#topic-form-title').textContent = topic ? 'Edit topic' : 'New topic';
  $('#topic-id').value = topic ? topic.id : '';
  $('#topic-name').value = topic ? topic.name : '';
  $('#topic-query').value = topic ? topic.query : '';
  $('#type-article').checked = topic ? topic.types.includes('article') : true;
  $('#type-video').checked = topic ? topic.types.includes('video') : false;
  $('#type-podcast').checked = topic ? topic.types.includes('podcast') : false;
  const temporary = Boolean(topic && topic.endDate);
  $('#topic-temporary').checked = temporary;
  $('#end-date-label').classList.toggle('hidden', !temporary);
  $('#topic-end-date').value = topic && topic.endDate ? topic.endDate : '';
  $('#topic-name').focus();
}

$('#add-topic-btn').addEventListener('click', () => openTopicForm(null));
$('#topic-cancel').addEventListener('click', () => $('#topic-form-wrap').classList.add('hidden'));

$('#topic-temporary').addEventListener('change', (e) => {
  $('#end-date-label').classList.toggle('hidden', !e.target.checked);
});

$('#topic-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const types = [
    $('#type-article').checked && 'article',
    $('#type-video').checked && 'video',
    $('#type-podcast').checked && 'podcast'
  ].filter(Boolean);
  if (!types.length) {
    alert('Pick at least one content type.');
    return;
  }
  const existing = topics.find((t) => t.id === $('#topic-id').value);
  await window.api.saveTopic({
    id: $('#topic-id').value || undefined,
    name: $('#topic-name').value.trim(),
    query: $('#topic-query').value.trim(),
    types,
    endDate: $('#topic-temporary').checked ? $('#topic-end-date').value || null : null,
    paused: existing ? existing.paused : false
  });
  $('#topic-form-wrap').classList.add('hidden');
  refreshAll();
});

// ---------- Settings ----------

function renderSettings() {
  $('#set-brave-key').value = settings.braveApiKey || '';
  $('#set-youtube-key').value = settings.youtubeApiKey || '';
  $('#set-fetch-time').value = settings.fetchTime || '08:00';
  $('#set-max-items').value = settings.maxItemsPerTopicPerFetch || 15;
  $('#last-fetch').textContent = settings.lastFetch
    ? new Date(settings.lastFetch).toLocaleString()
    : 'never';
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  settings = await window.api.saveSettings({
    braveApiKey: $('#set-brave-key').value.trim(),
    youtubeApiKey: $('#set-youtube-key').value.trim(),
    fetchTime: $('#set-fetch-time').value || '08:00',
    maxItemsPerTopicPerFetch: Number($('#set-max-items').value) || 15
  });
  const msg = $('#settings-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2000);
});

// ---------- Fetching ----------

$('#fetch-now-btn').addEventListener('click', () => {
  $('#fetch-now-btn').disabled = true;
  window.api.fetchNow();
});

window.api.onFetchStatus((status) => {
  const el = $('#fetch-status');
  if (status.state === 'running') {
    $('#fetch-now-btn').disabled = true;
    el.textContent = `Fetching… ${status.done}/${status.total} topics`;
  } else {
    $('#fetch-now-btn').disabled = false;
    const s = status.summary;
    if (s) {
      const failed = s.topics.filter((t) => t.errors.length);
      el.textContent = `${s.totalNew} new item${s.totalNew === 1 ? '' : 's'}` +
        (failed.length ? ` (${failed.length} source error${failed.length === 1 ? '' : 's'})` : '');
    } else {
      el.textContent = '';
    }
    refreshAll();
  }
});

refreshAll();
