// store.js
// Machines, baselines and reading history, kept in this browser's local storage.
// Nothing leaves the device unless the user exports it.

const KEY = 'auscult.v1';
const HISTORY_CAP = 400;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.machines)) return s;
    }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return { machines: [], currentId: null };
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.name === 'QuotaExceededError' ? 'Storage is full. Export a backup, then delete machines you no longer monitor.' : 'This browser blocked local storage, so changes will be lost when the page closes.' };
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newMachine(fields = {}) {
  return {
    id: uid(),
    name: fields.name || 'Untitled machine',
    tag: fields.tag || '',
    location: fields.location || '',
    rpm: Number(fields.rpm) || 0,
    lineHz: Number(fields.lineHz) || 50,
    bearingPreset: fields.bearingPreset || '',
    bearing: fields.bearing || null,
    point: fields.point || '',
    notes: fields.notes || '',
    createdAt: new Date().toISOString(),
    baseline: null,
    history: [],
  };
}

export function addReading(machine, reading) {
  machine.history.push(reading);
  if (machine.history.length > HISTORY_CAP) machine.history.splice(0, machine.history.length - HISTORY_CAP);
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function backupText(state) {
  return JSON.stringify({ app: 'auscult', version: 1, exportedAt: new Date().toISOString(), machines: state.machines }, null, 1);
}

/** Merge a backup into the current state. Machines with the same id are replaced by the backup copy. */
export function restore(state, text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not a valid backup (it is not JSON).'); }
  if (data?.app !== 'auscult' || !Array.isArray(data.machines)) throw new Error('That file is not an Auscult backup.');
  let added = 0, replaced = 0;
  for (const m of data.machines) {
    if (!m || typeof m.id !== 'string' || typeof m.name !== 'string') continue;
    m.history = Array.isArray(m.history) ? m.history : [];
    const i = state.machines.findIndex((x) => x.id === m.id);
    if (i >= 0) { state.machines[i] = m; replaced++; } else { state.machines.push(m); added++; }
  }
  return { added, replaced };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function historyCSV(machine) {
  const rows = [['time', 'machine', 'tag', 'source', 'health', 'zone', 'status', 'score', 'findings', 'note']];
  for (const h of machine.history) {
    rows.push([h.t, machine.name, machine.tag, h.source, h.health, h.zone, h.status, h.score, (h.findings || []).join(' | '), h.note || '']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
