// ─── UTILS ───────────────────────────────────────────────────────────────────
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const COLORS = { blue:'#3B82F6', teal:'#0D9488', purple:'#7C3AED', coral:'#F97316', amber:'#F59E0B', pink:'#EC4899', green:'#00D26A' };

function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function fmtDate(d) { return new Date(d).toLocaleDateString('es-SV',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtISO(d) { return new Date(d).toISOString().slice(0,10); }
function money(n) { return '$' + Number(n||0).toLocaleString('es-SV',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function nextOccurrence(day) {
  const now = today();
  let d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return d;
}

function daysUntil(d) {
  const now = today();
  return Math.round((new Date(d) - now) / 86400000);
}

function utilPct(limit, bal) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((bal / limit) * 100));
}

function utilColor(p) { return p >= 80 ? '#EF4444' : p >= 50 ? '#F59E0B' : '#00D26A'; }
function monthlyInterest(bal, annualRate) { return (bal || 0) * ((annualRate || 0) / 100 / 12); }

function badgeClass(days) {
  if (days <= 0) return 'badge-danger';
  if (days <= 1) return 'badge-danger';
  if (days <= 3) return 'badge-warn';
  return 'badge-gray';
}

function daysLabel(days) {
  if (days === 0) return '¡Hoy!';
  if (days === 1) return '¡Mañana!';
  return days + 'd';
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentUser = null;
let cards = [];
let payments = [];
let currentView = 'dashboard';

// ─── INIT ─────────────────────────────────────────────────────────────────────
(async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = currentUser.email[0].toUpperCase();
  document.getElementById('today-label').textContent = fmtDate(today());

  await loadData();
  renderAlerts();
  renderView('dashboard');

  if (Notification.permission === 'granted') checkNotifications();
})();

// ─── DATA ─────────────────────────────────────────────────────────────────────
async function loadData() {
  const [{ data: c }, { data: p }] = await Promise.all([
    db.from('cards').select('*').eq('user_id', currentUser.id).order('created_at'),
    db.from('payments').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }),
  ]);
  cards = c || [];
  payments = p || [];
}

async function doLogout() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  cards: 'Mis tarjetas',
  timeline: 'Calendario de pagos',
  history: 'Historial de pagos',
  strategy: 'Estrategia de pago',
  tips: 'Consejos financieros',
};

function showView(name, btn) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-title').textContent = VIEW_TITLES[name];
  document.getElementById('btn-add-card').style.display = name === 'cards' || name === 'dashboard' ? '' : 'none';
  currentView = name;
  renderView(name);
}

function renderView(name) {
  const el = document.getElementById('view-content');
  el.innerHTML = '';
  if (name === 'dashboard') renderDashboard(el);
  else if (name === 'cards') renderCards(el);
  else if (name === 'timeline') renderTimeline(el);
  else if (name === 'history') renderHistory(el);
  else if (name === 'strategy') renderStrategy(el);
  else if (name === 'tips') renderTips(el);
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
function renderAlerts() {
  const wrap = document.getElementById('alerts-wrap');
  const alerts = [];

  cards.forEach(card => {
    const cutDate = nextOccurrence(card.cut_day);
    const payDate = nextOccurrence(card.pay_day);
    const cd = daysUntil(cutDate);
    const pd = daysUntil(payDate);

    if (cd === 0) alerts.push({ t: 'danger', msg: `<strong>${card.name}</strong>: Hoy es tu fecha de corte. Realiza el pago mínimo de <strong>${money(card.min_payment)}</strong>.` });
    else if (cd === 1) alerts.push({ t: 'warning', msg: `<strong>${card.name}</strong>: Mañana es tu fecha de corte. Prepara el pago mínimo de <strong>${money(card.min_payment)}</strong>.` });
    else if (cd <= 3) alerts.push({ t: 'warning', msg: `<strong>${card.name}</strong>: Fecha de corte en ${cd} días (${fmtDate(cutDate)}).` });

    if (pd === 0) alerts.push({ t: 'danger', msg: `<strong>${card.name}</strong>: ¡Hoy vence tu pago! Paga el total de <strong>${money(card.balance)}</strong> para evitar intereses.` });
    else if (pd === 1) alerts.push({ t: 'danger', msg: `<strong>${card.name}</strong>: ¡Mañana vence el pago! Paga hoy el saldo de <strong>${money(card.balance)}</strong>.` });
    else if (pd <= 3) alerts.push({ t: 'warning', msg: `<strong>${card.name}</strong>: Fecha de pago en ${pd} días (${fmtDate(payDate)}).` });

    const up = utilPct(card.credit_limit, card.balance);
    if (up >= 80) alerts.push({ t: 'warning', msg: `<strong>${card.name}</strong>: Utilización alta (${up}%). Mantenerla bajo 30% mejora tu historial crediticio.` });
  });

  if (alerts.length === 0) {
    wrap.innerHTML = `<div class="alert alert-success">✅ Todo en orden — sin fechas urgentes próximas.</div>`;
  } else {
    wrap.innerHTML = alerts.map(a =>
      `<div class="alert alert-${a.t}"><span>${a.t === 'danger' ? '🔴' : '🟡'}</span><span>${a.msg}</span></div>`
    ).join('');
  }
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function circleGauge(pct, color, size = 80) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - Math.min(pct, 100) / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#E8EAF0" stroke-width="7"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
      stroke-dasharray="${circ}" stroke-dashoffset="${fill}" stroke-linecap="round"
      style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 0.5s"/>
  </svg>`;
}

function renderDashboard(el) {
  if (cards.length === 0) {
    el.innerHTML = emptyState('💳', 'Agrega tu primera tarjeta', 'Haz clic en "+ Nueva tarjeta" para comenzar.');
    return;
  }

  const totalDebt = cards.reduce((s, c) => s + (c.balance || 0), 0);
  const totalLimit = cards.reduce((s, c) => s + (c.credit_limit || 0), 0);
  const totalMin = cards.reduce((s, c) => s + (c.min_payment || 0), 0);
  const totalInterest = cards.reduce((s, c) => s + monthlyInterest(c.balance, c.interest_rate), 0);
  const avgUtil = totalLimit ? Math.round((totalDebt / totalLimit) * 100) : 0;
  const utilClr = utilColor(avgUtil);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const paidThisMonth = payments.filter(p => p.date && p.date.startsWith(thisMonth)).reduce((s, p) => s + (p.amount || 0), 0);
  const paidCount = payments.filter(p => p.date && p.date.startsWith(thisMonth)).length;

  const events = [];
  cards.forEach(c => {
    events.push({ days: daysUntil(nextOccurrence(c.cut_day)), label: `Corte — ${c.name}`, date: nextOccurrence(c.cut_day), type: 'cut', card: c });
    events.push({ days: daysUntil(nextOccurrence(c.pay_day)), label: `Pago — ${c.name}`, date: nextOccurrence(c.pay_day), type: 'pay', card: c });
  });
  events.sort((a, b) => a.days - b.days);

  el.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card dark">
        <div class="label">Deuda total</div>
        <div class="value">${money(totalDebt)}</div>
        <div class="sub">${cards.length} tarjeta${cards.length !== 1 ? 's' : ''} activa${cards.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="metric-card green">
        <div class="label">Pagado este mes</div>
        <div class="value">${money(paidThisMonth)}</div>
        <div class="sub">${paidCount} pago${paidCount !== 1 ? 's' : ''} registrado${paidCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="metric-card">
        <div class="label">Utilización</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <div class="circle-wrap">${circleGauge(avgUtil, utilClr, 72)}<span class="circle-label" style="color:${utilClr}">${avgUtil}%</span></div>
          <div>
            <div class="value" style="font-size:16px;color:${utilClr}">${avgUtil <= 30 ? 'Excelente' : avgUtil <= 50 ? 'Aceptable' : avgUtil <= 80 ? 'Alta' : 'Crítica'}</div>
            <div class="sub">Límite: ${money(totalLimit)}</div>
          </div>
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Pago mínimo/mes</div>
        <div class="value">${money(totalMin)}</div>
        <div class="sub">mínimo requerido</div>
      </div>
      <div class="metric-card">
        <div class="label">Interés estimado</div>
        <div class="value" style="color:var(--danger)">${money(totalInterest)}</div>
        <div class="sub">si no pagas el total</div>
      </div>
    </div>
    <div class="section-title">Próximos eventos</div>
    <div class="timeline">
      ${events.slice(0, 6).map(e => `
        <div class="tl-item">
          <div class="tl-date">
            <div class="tl-day">${e.date.getDate()}</div>
            <div class="tl-mon">${MONTHS[e.date.getMonth()]}</div>
          </div>
          <div class="tl-dot" style="background:${e.type === 'cut' ? '#F59E0B' : '#00D26A'}"></div>
          <div class="tl-body">
            <div class="tl-title">${e.label}</div>
            <div class="tl-sub">${fmtDate(e.date)} · ${e.type === 'cut' ? 'Pago mínimo: ' + money(e.card.min_payment) : 'Saldo: ' + money(e.card.balance)}</div>
          </div>
          <span class="badge ${badgeClass(e.days)}">${daysLabel(e.days)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── CARDS ────────────────────────────────────────────────────────────────────
function renderCards(el) {
  if (cards.length === 0) {
    el.innerHTML = emptyState('💳', 'Sin tarjetas aún', 'Agrega tu primera tarjeta para comenzar.');
    return;
  }

  el.innerHTML = `<div class="cards-grid">${cards.map(card => {
    const cutDate = nextOccurrence(card.cut_day);
    const payDate = nextOccurrence(card.pay_day);
    const cd = daysUntil(cutDate);
    const pd = daysUntil(payDate);
    const up = utilPct(card.credit_limit, card.balance);
    const mi = monthlyInterest(card.balance, card.interest_rate);
    const color = COLORS[card.color] || COLORS.blue;

    return `
      <div class="card">
        <div class="card-stripe accent-${card.color || 'blue'}"></div>
        <div class="card-body">
          <div class="card-header-row">
            <div>
              <div class="card-name">${card.name}</div>
              <div class="card-bank">${card.bank || '—'}</div>
            </div>
            <span class="badge ${up >= 80 ? 'badge-danger' : up >= 50 ? 'badge-warn' : 'badge-ok'}">${up}% uso</span>
          </div>
          <div class="card-row">
            <span class="row-label">✂️ Corte (día ${card.cut_day})</span>
            <span>${fmtDate(cutDate)} <span class="badge ${badgeClass(cd)}">${daysLabel(cd)}</span></span>
          </div>
          <div class="card-row">
            <span class="row-label">📅 Pago (día ${card.pay_day})</span>
            <span>${fmtDate(payDate)} <span class="badge ${badgeClass(pd)}">${daysLabel(pd)}</span></span>
          </div>
          <div class="card-row">
            <span class="row-label">💰 Saldo actual</span>
            <span class="row-value">${money(card.balance)}</span>
          </div>
          ${card.credit_limit ? `<div class="card-row"><span class="row-label">💳 Límite</span><span>${money(card.credit_limit)}</span></div>` : ''}
          ${card.min_payment ? `<div class="card-row"><span class="row-label">🪙 Pago mínimo</span><span>${money(card.min_payment)}</span></div>` : ''}
          ${card.interest_rate ? `<div class="card-row"><span class="row-label">📈 Interés/mes est.</span><span class="text-danger">${money(mi)}</span></div>` : ''}
          ${card.credit_limit ? `
            <div class="progress-wrap">
              <div class="progress-bar"><div class="progress-fill" style="width:${up}%;background:${utilColor(up)}"></div></div>
              <div class="progress-labels"><span>${money(card.balance)}</span><span>${money(card.credit_limit)}</span></div>
            </div>` : ''}
          ${card.notes ? `<p style="font-size:12px;color:var(--text-muted);margin-top:8px;font-style:italic">${card.notes}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="openPaymentModal('${card.id}')">💵 Pagar</button>
          <button class="btn btn-sm" onclick="openCardModal('${card.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCard('${card.id}')">🗑</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function renderTimeline(el) {
  if (cards.length === 0) { el.innerHTML = emptyState('📅', 'Sin tarjetas', 'Agrega tarjetas para ver el calendario.'); return; }

  const events = [];
  const now = today();
  cards.forEach(c => {
    for (let m = 0; m < 2; m++) {
      const cutD = new Date(now.getFullYear(), now.getMonth() + m, c.cut_day);
      const payD = new Date(now.getFullYear(), now.getMonth() + m, c.pay_day);
      if (cutD >= now) events.push({ date: cutD, card: c, type: 'cut', days: daysUntil(cutD) });
      if (payD >= now) events.push({ date: payD, card: c, type: 'pay', days: daysUntil(payD) });
    }
  });

  const seen = new Set();
  const unique = events.filter(e => {
    const k = e.card.id + e.type + e.date.toISOString().slice(0, 7);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => a.date - b.date);

  el.innerHTML = `<div class="timeline">${unique.slice(0, 24).map(e => {
    const isCut = e.type === 'cut';
    return `
      <div class="tl-item">
        <div class="tl-date">
          <div class="tl-day">${e.date.getDate()}</div>
          <div class="tl-mon">${MONTHS[e.date.getMonth()]} ${e.date.getFullYear()}</div>
        </div>
        <div class="tl-dot" style="background:${isCut ? '#F59E0B' : '#00D26A'}"></div>
        <div class="tl-body">
          <div class="tl-title" style="display:flex;align-items:center;gap:8px">
            ${e.card.name}
            <span class="badge ${isCut ? 'badge-warn' : 'badge-info'}">${isCut ? '✂️ Corte' : '💳 Pago'}</span>
          </div>
          <div class="tl-sub">
            ${isCut
              ? `Al cierre paga el mínimo de <strong>${money(e.card.min_payment)}</strong> para proteger tu historial.`
              : `Paga el saldo de <strong>${money(e.card.balance)}</strong> para evitar intereses. Un día antes (día ${e.card.pay_day - 1}): paga el resto del saldo pendiente.`
            }
          </div>
        </div>
        <span class="badge ${badgeClass(e.days)}">${daysLabel(e.days)}</span>
      </div>`;
  }).join('')}</div>`;
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function renderHistory(el) {
  if (payments.length === 0) {
    el.innerHTML = emptyState('🕓', 'Sin pagos registrados', 'Usa el botón "Pagar" en una tarjeta para registrar un pago.');
    return;
  }

  const byMonth = {};
  payments.forEach(p => {
    const m = p.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(p);
  });

  let html = '';
  Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).forEach(month => {
    const [y, m] = month.split('-');
    const total = byMonth[month].reduce((s, p) => s + (p.amount || 0), 0);
    html += `<div class="section-title">${MONTHS_LONG[parseInt(m) - 1]} ${y} — pagado: ${money(total)}</div>
    <div class="hist-list">`;
    byMonth[month].forEach(p => {
      const card = cards.find(c => c.id === p.card_id);
      const typeLabel = { minimum: 'Mínimo', partial: 'Parcial', full: 'Total' }[p.type] || p.type;
      html += `<div class="hist-item">
        <div>
          <div class="fw-bold">${card ? card.name : 'Tarjeta eliminada'}</div>
          <div class="text-sm text-muted" style="margin-top:2px">${p.date} · <span class="badge ${p.type === 'full' ? 'badge-ok' : p.type === 'minimum' ? 'badge-warn' : 'badge-info'}">${typeLabel}</span>${p.notes ? ' · ' + p.notes : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="fw-bold text-success">${money(p.amount)}</span>
          <button class="btn btn-sm btn-danger" onclick="deletePayment('${p.id}')">🗑</button>
        </div>
      </div>`;
    });
    html += `</div><div class="divider"></div>`;
  });
  el.innerHTML = html;
}

// ─── STRATEGY ─────────────────────────────────────────────────────────────────
function renderStrategy(el) {
  if (cards.length === 0) { el.innerHTML = emptyState('🎯', 'Sin tarjetas', 'Agrega tarjetas para ver la estrategia.'); return; }

  const withDebt = [...cards].filter(c => c.balance > 0).sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0));
  const noDebt = cards.filter(c => !c.balance || c.balance <= 0);

  let html = `<div class="alert alert-info">
    <span>🎯</span>
    <span><strong>Método avalancha:</strong> Paga primero la tarjeta con la tasa más alta para reducir el costo total. Mantén el pago mínimo en todas las demás para proteger tu historial crediticio.</span>
  </div>`;

  if (withDebt.length === 0) {
    html += `<div class="alert alert-success">✅ ¡Sin deuda activa! Excelente salud financiera.</div>`;
  } else {
    html += `<div class="section-title">Orden de prioridad</div>`;
    withDebt.forEach((card, i) => {
      const mi = monthlyInterest(card.balance, card.interest_rate);
      html += `<div class="strategy-card">
        <div class="strategy-rank" style="${i === 0 ? 'background:#fef2f2;color:#dc2626' : ''}">${i + 1}</div>
        <div style="flex:1">
          <div class="fw-bold">${card.name} <span class="text-muted text-sm">— ${card.bank || ''}</span></div>
          <div class="flex gap-3 flex-wrap mt-1">
            <span class="text-sm">Saldo: <strong>${money(card.balance)}</strong></span>
            <span class="text-sm">Tasa: <strong>${card.interest_rate || 0}% anual</strong></span>
            <span class="text-sm text-danger">Interés/mes: <strong>${money(mi)}</strong></span>
          </div>
          <div class="text-sm mt-1" style="color:${i === 0 ? '#16a34a' : 'var(--text-muted)'}">
            ${i === 0 ? '→ Enfoca el pago extra aquí primero' : `→ Solo pago mínimo (${money(card.min_payment)}) hasta liquidar #1`}
          </div>
        </div>
      </div>`;
    });
  }

  if (noDebt.length > 0) {
    html += `<div class="section-title mt-3">Sin deuda activa</div>`;
    noDebt.forEach(card => {
      html += `<div class="strategy-card">
        <div class="strategy-rank" style="background:var(--green-light);color:var(--green-text)">✓</div>
        <div><div class="fw-bold">${card.name}</div><div class="text-sm" style="color:var(--green-text)">Saldo $0 — al día</div></div>
      </div>`;
    });
  }

  el.innerHTML = html;
}

// ─── TIPS ─────────────────────────────────────────────────────────────────────
function renderTips(el) {
  const avgUtil = (() => {
    const wl = cards.filter(c => c.credit_limit > 0);
    if (!wl.length) return 0;
    return Math.round(wl.reduce((s, c) => s + utilPct(c.credit_limit, c.balance), 0) / wl.length);
  })();

  const tips = [
    { icon: '📊', title: 'Utilización óptima', text: `Mantén cada tarjeta por debajo del 30% de su límite. Tu promedio actual es ${avgUtil}%. ${avgUtil <= 30 ? '¡Estás en el rango ideal!' : avgUtil <= 50 ? 'Intenta reducirlo un poco.' : 'Utilización alta — esto afecta tu score crediticio.'}` },
    { icon: '📅', title: 'Paga siempre a tiempo', text: 'El historial de pagos es el factor más importante de tu score. Un solo pago tardío puede afectarte por años. Configura recordatorios para nunca olvidar.' },
    { icon: '✂️', title: 'Aprovecha la fecha de corte', text: 'Si haces gastos grandes justo después del corte, tienes hasta ~25 días extra antes de que se reflejen en tu estado de cuenta, sin pagar intereses adicionales.' },
    { icon: '💯', title: 'Paga el total, no el mínimo', text: 'Pagar solo el mínimo puede convertir una deuda de $500 en años de pagos. El interés se acumula mensualmente. Siempre intenta pagar el saldo completo.' },
    { icon: '📈', title: 'El costo real de los intereses', text: `Con tasas del 30–50% anual, una deuda de ${money(cards.reduce((s,c)=>s+(c.balance||0),0))} te cuesta aprox. ${money(cards.reduce((s,c)=>s+monthlyInterest(c.balance,c.interest_rate||36),0))} en intereses al mes si no pagas el total.` },
    { icon: '🏦', title: 'No cierres tarjetas antiguas', text: 'La antigüedad del crédito influye en tu historial. Una tarjeta sin deuda sigue aportando positivamente. Si quieres reducir, baja el límite en lugar de cerrarla.' },
    { icon: '🚫', title: 'Evita el avance en efectivo', text: 'El "cash advance" cobra intereses desde el primer día, sin período de gracia, a tasas aún más altas. Úsalo solo en emergencias absolutas.' },
    { icon: '🎯', title: 'Usa las tarjetas con estrategia', text: 'Usar tarjetas y pagarlas en total cada mes genera un excelente historial y puede darte acceso a mejores productos financieros en el futuro.' },
  ];

  el.innerHTML = `<div class="tips-grid">${tips.map(t =>
    `<div class="tip-card"><div class="tip-icon">${t.icon}</div><div class="tip-title">${t.title}</div><div class="tip-text">${t.text}</div></div>`
  ).join('')}</div>`;
}

// ─── CARD CRUD ────────────────────────────────────────────────────────────────
function openCardModal(id) {
  document.getElementById('form-card').reset();
  document.getElementById('fc-id').value = '';
  document.getElementById('modal-card-title').textContent = 'Nueva tarjeta';

  if (id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    document.getElementById('modal-card-title').textContent = 'Editar tarjeta';
    document.getElementById('fc-id').value = card.id;
    document.getElementById('fc-name').value = card.name || '';
    document.getElementById('fc-bank').value = card.bank || '';
    document.getElementById('fc-color').value = card.color || 'blue';
    document.getElementById('fc-cut').value = card.cut_day || '';
    document.getElementById('fc-pay').value = card.pay_day || '';
    document.getElementById('fc-limit').value = card.credit_limit || '';
    document.getElementById('fc-balance').value = card.balance || '';
    document.getElementById('fc-min').value = card.min_payment || '';
    document.getElementById('fc-rate').value = card.interest_rate || '';
    document.getElementById('fc-notes').value = card.notes || '';
  }
  document.getElementById('modal-card').classList.add('open');
}

async function saveCard(e) {
  e.preventDefault();
  const id = document.getElementById('fc-id').value;
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('fc-name').value.trim(),
    bank: document.getElementById('fc-bank').value.trim(),
    color: document.getElementById('fc-color').value,
    cut_day: parseInt(document.getElementById('fc-cut').value),
    pay_day: parseInt(document.getElementById('fc-pay').value),
    credit_limit: parseFloat(document.getElementById('fc-limit').value) || 0,
    balance: parseFloat(document.getElementById('fc-balance').value) || 0,
    min_payment: parseFloat(document.getElementById('fc-min').value) || 0,
    interest_rate: parseFloat(document.getElementById('fc-rate').value) || 0,
    notes: document.getElementById('fc-notes').value.trim(),
  };

  if (id) {
    await db.from('cards').update(payload).eq('id', id);
  } else {
    await db.from('cards').insert(payload);
  }

  closeModal('modal-card');
  await loadData();
  renderAlerts();
  renderView(currentView);
}

async function deleteCard(id) {
  if (!confirm('¿Eliminar esta tarjeta y todos sus pagos registrados?')) return;
  await Promise.all([
    db.from('cards').delete().eq('id', id),
    db.from('payments').delete().eq('card_id', id),
  ]);
  await loadData();
  renderAlerts();
  renderView(currentView);
}

// ─── PAYMENT CRUD ─────────────────────────────────────────────────────────────
function openPaymentModal(cardId) {
  const card = cards.find(c => c.id === cardId);
  if (!card) return;
  document.getElementById('form-payment').reset();
  document.getElementById('fp-cardid').value = cardId;
  document.getElementById('fp-cardname').value = card.name;
  document.getElementById('fp-date').value = fmtISO(today());
  if (card.balance) document.getElementById('fp-amount').value = card.balance.toFixed(2);
  document.getElementById('modal-payment').classList.add('open');
}

async function savePayment(e) {
  e.preventDefault();
  const cardId = document.getElementById('fp-cardid').value;
  const amount = parseFloat(document.getElementById('fp-amount').value) || 0;
  const shouldUpdate = document.getElementById('fp-update').value === 'yes';

  await db.from('payments').insert({
    user_id: currentUser.id,
    card_id: cardId,
    amount,
    date: document.getElementById('fp-date').value,
    type: document.getElementById('fp-type').value,
    notes: document.getElementById('fp-notes').value.trim(),
  });

  if (shouldUpdate) {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      const newBalance = Math.max(0, (card.balance || 0) - amount);
      await db.from('cards').update({ balance: newBalance }).eq('id', cardId);
    }
  }

  closeModal('modal-payment');
  await loadData();
  renderAlerts();
  renderView(currentView);
}

async function deletePayment(id) {
  if (!confirm('¿Eliminar este registro de pago?')) return;
  await db.from('payments').delete().eq('id', id);
  await loadData();
  renderView('history');
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
});

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────
function exportData() {
  const data = { cards, payments, exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cardcontrol-backup-${fmtISO(today())}.json`;
  a.click();
}

async function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.cards) { alert('Archivo inválido.'); return; }
      if (!confirm(`¿Importar ${data.cards.length} tarjeta(s) y ${(data.payments||[]).length} pago(s)? Se agregarán a tus datos actuales.`)) return;

      for (const card of data.cards) {
        const { id, ...rest } = card;
        await db.from('cards').insert({ ...rest, user_id: currentUser.id });
      }
      await loadData();
      renderAlerts();
      renderView(currentView);
    } catch { alert('Error al leer el archivo.'); }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function checkNotifications() {
  cards.forEach(card => {
    const cd = daysUntil(nextOccurrence(card.cut_day));
    const pd = daysUntil(nextOccurrence(card.pay_day));
    if (cd <= 3) new Notification(`CardControl — Corte: ${card.name}`, { body: `Fecha de corte en ${cd} día(s). Pago mínimo: ${money(card.min_payment)}` });
    if (pd <= 1) new Notification(`CardControl — ¡Pago urgente: ${card.name}!`, { body: `Vence ${pd === 0 ? 'HOY' : 'MAÑANA'}. Saldo: ${money(card.balance)}` });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function emptyState(icon, title, text) {
  return `<div class="empty-state"><div class="icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
}
