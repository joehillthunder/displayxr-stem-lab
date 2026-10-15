// Control builders for the lesson panel. A lesson asks for controls through `ctx.ui` and gets
// plain DOM back; everything is cleared when the lesson changes.

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export function makeUI(root) {
  root.innerHTML = '';
  const ui = {
    /** Range slider. `fmt(v)` formats the readout. Returns { get, set, el }. */
    slider(label, { min = 0, max = 1, step = 0.01, value = min, fmt = (v) => v, onChange = () => {} } = {}) {
      const row = el('label', 'ctl slider');
      const top = el('div', 'ctl-top');
      const name = el('span', 'ctl-name', label);
      const out = el('output', 'ctl-val');
      const input = el('input');
      Object.assign(input, { type: 'range', min, max, step, value });
      const show = () => (out.innerHTML = fmt(+input.value));
      input.addEventListener('input', () => { show(); onChange(+input.value); });
      top.append(name, out);
      row.append(top, input);
      root.append(row);
      show();
      return { el: row, get: () => +input.value, set(v, fire = false) { input.value = v; show(); if (fire) onChange(+input.value); } };
    },
    /** On/off switch. Returns { get, set, el }. */
    toggle(label, { value = false, onChange = () => {} } = {}) {
      const row = el('label', 'ctl toggle');
      const input = el('input');
      input.type = 'checkbox';
      input.checked = value;
      input.addEventListener('change', () => onChange(input.checked));
      row.append(input, el('span', 'sw'), el('span', 'ctl-name', label));
      root.append(row);
      return { el: row, get: () => input.checked, set(v, fire = false) { input.checked = v; if (fire) onChange(v); } };
    },
    /** Segmented choice. options: [{ value, label }] or strings. Returns { get, set, el }. */
    choice(label, { options = [], value, onChange = () => {} } = {}) {
      const row = el('div', 'ctl choice');
      if (label) row.append(el('div', 'ctl-name', label));
      const seg = el('div', 'seg');
      const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));
      let cur = value ?? opts[0]?.value;
      const btns = opts.map((o) => {
        const b = el('button', '', o.label);
        b.type = 'button';
        b.addEventListener('click', () => api.set(o.value, true));
        seg.append(b);
        return b;
      });
      const paint = () => btns.forEach((b, i) => b.classList.toggle('on', opts[i].value === cur));
      const api = { el: row, get: () => cur, set(v, fire = false) { cur = v; paint(); if (fire) onChange(v); } };
      paint();
      row.append(seg);
      root.append(row);
      return api;
    },
    /** Dropdown, for long option lists. Returns { get, set, el }. */
    select(label, { options = [], value, onChange = () => {} } = {}) {
      const row = el('label', 'ctl select');
      row.append(el('span', 'ctl-name', label));
      const s = el('select');
      for (const o of options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }))) {
        const op = el('option', '', o.label);
        op.value = o.value;
        s.append(op);
      }
      if (value != null) s.value = value;
      s.addEventListener('change', () => onChange(s.value));
      row.append(s);
      root.append(row);
      return { el: row, get: () => s.value, set(v, fire = false) { s.value = v; if (fire) onChange(v); } };
    },
    /** A button (or a row of them: pass several and they share a line). */
    button(label, onClick, { primary = false } = {}) {
      let row = root.lastElementChild;
      if (!row || !row.classList.contains('btnrow')) root.append((row = el('div', 'btnrow')));
      const b = el('button', 'btn' + (primary ? ' primary' : ''), label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      row.append(b);
      return b;
    },
    /** A live readout. Returns { set(html), el }. */
    readout(label, value = '') {
      const row = el('div', 'ctl readout');
      const v = el('span', 'ctl-val', value);
      row.append(el('span', 'ctl-name', label), v);
      root.append(row);
      return { el: row, set: (html) => { if (v.innerHTML !== String(html)) v.innerHTML = html; } };
    },
    /** A free text note (HTML). Returns { set(html), el }. */
    note(html = '') {
      const n = el('p', 'ctl-note', html);
      root.append(n);
      return { el: n, set: (h) => { if (n.innerHTML !== h) n.innerHTML = h; } };
    },
    /** A small sub-heading inside the controls. */
    heading(text) {
      root.append(el('h4', 'ctl-head', text));
    },
  };
  return ui;
}
