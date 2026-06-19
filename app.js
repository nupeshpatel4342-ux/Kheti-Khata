// ============================================================
// KhetiKhata — Vanilla JS Single-Page Application
// Farm & Bhag Hisab Management
// ============================================================

// ── Constants ────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Beej (Seeds)', 'Khatar (Fertilizer)', 'Paani/Vijbil (Water)', 'Majoori (Labor)', 'Davaa (Pesticide)', 'Bharadu/Other'];
const UNITS = ['Kilo', 'Quintal', 'Mann', 'Nag', 'Other'];

// ── Utility Helpers ──────────────────────────────────────────

/** Today's date as YYYY-MM-DD */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Format number as ₹ Indian locale */
function fmt(n) {
  const num = Number(n) || 0;
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Format date string to dd-MMM-yyyy */
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Generate a short unique ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Create an empty farm object */
function emptyFarm(name, jethi, bhagyo) {
  return {
    id: genId(),
    farmName: name,
    jethiName: jethi,
    bhagyoName: bhagyo,
    expenses: [],
    incomes: [],
    udhars: [],
    settlements: []
  };
}

// ── Application State ────────────────────────────────────────
const state = {
  screen: 'auth',        // auth | farmSelect | createFarm | app
  authMode: 'select',    // select | pin | create
  authError: '',
  profiles: [],
  currentProfile: null,
  selectedLoginProfile: null,
  pinInput: '',
  newName: '',
  newPin: '',
  newPin2: '',

  farms: [],
  currentFarmId: null,
  newFarmForm: { farmName: '', jethiName: '', bhagyoName: '' },

  activeTab: 'dashboard',
  editingInfo: false,
  infoForm: { farmName: '', jethiName: '', bhagyoName: '' },

  expForm: { date: todayStr(), category: EXPENSE_CATEGORIES[0], amount: '', note: '' },
  incForm: { date: todayStr(), crop: '', qty: '', unit: UNITS[0], rate: '', note: '' },
  udharForm: { date: todayStr(), type: 'given', amount: '', note: '' },
  settleForm: { note: '', jethiPercent: 50, deductUdhar: false, deductAmount: '' },

  confirmDelete: null,
  expandedSettlement: null,
  saveError: false
};

// ── Persistence ──────────────────────────────────────────────

function persistProfiles(list) {
  localStorage.setItem('khetikhata-profiles', JSON.stringify(list));
}

function persistFarms(list) {
  if (!state.currentProfile) return;
  localStorage.setItem(`khetikhata-farms:${state.currentProfile.id}`, JSON.stringify(list));
}

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem('khetikhata-profiles')) || [];
  } catch { return []; }
}

function loadFarms(profileId) {
  try {
    return JSON.parse(localStorage.getItem(`khetikhata-farms:${profileId}`)) || [];
  } catch { return []; }
}

// ── Computed Values (derived from current farm) ──────────────

function getCurrentFarm() {
  return state.farms.find(f => f.id === state.currentFarmId) || null;
}

function getUnsettledExpenses(farm) {
  if (!farm) return [];
  return farm.expenses.filter(e => !e.settled).sort((a, b) => b.date.localeCompare(a.date));
}

function getUnsettledIncomes(farm) {
  if (!farm) return [];
  return farm.incomes.filter(i => !i.settled).sort((a, b) => b.date.localeCompare(a.date));
}

function getTotalExpense(unsettled) {
  return unsettled.reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

function getTotalIncome(unsettled) {
  return unsettled.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

function getUdharGiven(farm) {
  if (!farm) return 0;
  return farm.udhars.filter(u => u.type === 'given').reduce((s, u) => s + (Number(u.amount) || 0), 0);
}

function getUdharRepaid(farm) {
  if (!farm) return 0;
  return farm.udhars.filter(u => u.type === 'repaid').reduce((s, u) => s + (Number(u.amount) || 0), 0);
}

function getRecentActivity(farm) {
  if (!farm) return [];
  const all = [
    ...farm.expenses.map(e => ({ ...e, _type: 'expense' })),
    ...farm.incomes.map(i => ({ ...i, _type: 'income' })),
    ...farm.udhars.map(u => ({ ...u, _type: 'udhar' }))
  ];
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}

function getSortedUdhars(farm) {
  if (!farm) return [];
  return [...farm.udhars].sort((a, b) => b.date.localeCompare(a.date));
}

function getSortedSettlements(farm) {
  if (!farm) return [];
  return [...farm.settlements].sort((a, b) => b.date.localeCompare(a.date));
}

// ── Farm Mutation Helpers ────────────────────────────────────

function updateFarm(farmId, updater) {
  state.farms = state.farms.map(f => f.id === farmId ? updater(f) : f);
  persistFarms(state.farms);
}

// ── Render Engine ────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  let html = '';
  switch (state.screen) {
    case 'auth':        html = renderAuth(); break;
    case 'farmSelect':  html = renderFarmSelect(); break;
    case 'createFarm':  html = renderCreateFarm(); break;
    case 'app':         html = renderApp(); break;
  }
  app.innerHTML = html;
  bindEvents();
  // Render Lucide SVG icons from <i data-lucide="..."> tags
  if (window.lucide) lucide.createIcons();
}

// ── AUTH SCREEN ──────────────────────────────────────────────

function renderAuth() {
  let inner = '';
  if (state.authMode === 'select') {
    inner = renderAuthSelect();
  } else if (state.authMode === 'pin') {
    inner = renderAuthPin();
  } else {
    inner = renderAuthCreate();
  }
  return `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-header">
          <i data-lucide="sprout" class="auth-logo-icon"></i>
          <h1>KhetiKhata</h1>
          <p class="auth-subtitle">Farm & Bhag Hisab</p>
        </div>
        ${inner}
      </div>
    </div>`;
}

function renderAuthSelect() {
  const list = state.profiles.map(p => `
    <button class="profile-btn" data-action="selectProfile" data-id="${p.id}">
      <span class="profile-name">${esc(p.name)}</span>
      <i data-lucide="chevron-down" style="width:16px;height:16px;"></i>
    </button>`).join('');
  return `
    <div class="auth-body">
      <h3>Select Profile</h3>
      <div class="profile-list">${list}</div>
      <button class="btn btn-outline btn-block" data-action="goCreateProfile">
        <i data-lucide="plus" style="width:16px;height:16px;"></i> New Profile
      </button>
    </div>`;
}

function renderAuthPin() {
  const p = state.selectedLoginProfile;
  return `
    <div class="auth-body">
      <button class="btn-link" data-action="backToSelect">← Back</button>
      <h3>${esc(p.name)}</h3>
      <div class="form-group">
        <label><i data-lucide="lock" style="width:14px;height:14px;"></i> Enter PIN</label>
        <input type="password" maxlength="4" inputmode="numeric" class="input" id="pinInput" placeholder="4-digit PIN" value="${esc(state.pinInput)}">
      </div>
      ${state.authError ? `<p class="error-text">${esc(state.authError)}</p>` : ''}
      <button class="btn btn-primary btn-block" data-action="loginPin">Login</button>
    </div>`;
}

function renderAuthCreate() {
  return `
    <div class="auth-body">
      ${state.profiles.length > 0 ? `<button class="btn-link" data-action="backToSelect">← Back</button>` : ''}
      <h3>Create Profile</h3>
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="input" id="newNameInput" placeholder="Your name" value="${esc(state.newName)}">
      </div>
      <div class="form-group">
        <label>PIN (4 digits)</label>
        <input type="password" maxlength="4" inputmode="numeric" class="input" id="newPinInput" placeholder="PIN" value="${esc(state.newPin)}">
      </div>
      <div class="form-group">
        <label>Confirm PIN</label>
        <input type="password" maxlength="4" inputmode="numeric" class="input" id="newPin2Input" placeholder="Confirm PIN" value="${esc(state.newPin2)}">
      </div>
      ${state.authError ? `<p class="error-text">${esc(state.authError)}</p>` : ''}
      <button class="btn btn-primary btn-block" data-action="createProfile">Create</button>
    </div>`;
}

// ── FARM SELECT SCREEN ───────────────────────────────────────

function renderFarmSelect() {
  const farmCards = state.farms.map(f => `
    <button class="farm-card" data-action="selectFarm" data-id="${f.id}">
      <i data-lucide="sprout" class="farm-card-icon"></i>
      <div>
        <div class="farm-card-name">${esc(f.farmName)}</div>
        <div class="farm-card-meta">${esc(f.jethiName || '—')} / ${esc(f.bhagyoName || '—')}</div>
      </div>
    </button>`).join('');

  return `
    <div class="auth-screen">
      <div class="auth-card" style="max-width:420px;">
        <div class="auth-header">
          <i data-lucide="sprout" class="auth-logo-icon"></i>
          <h1>KhetiKhata</h1>
          <p class="auth-subtitle">Welcome, ${esc(state.currentProfile.name)}</p>
        </div>
        <div class="auth-body">
          <h3>Your Farms</h3>
          ${farmCards || '<p class="empty-text">No farms yet. Create your first farm below.</p>'}
          <button class="btn btn-primary btn-block" data-action="goCreateFarm" style="margin-top:12px;">
            <i data-lucide="plus" style="width:16px;height:16px;"></i> New Farm
          </button>
          <button class="btn btn-outline btn-block" data-action="logout" style="margin-top:8px;">
            <i data-lucide="log-out" style="width:16px;height:16px;"></i> Logout
          </button>
        </div>
      </div>
    </div>`;
}

// ── CREATE FARM SCREEN ───────────────────────────────────────

function renderCreateFarm() {
  const f = state.newFarmForm;
  return `
    <div class="auth-screen">
      <div class="auth-card" style="max-width:420px;">
        <div class="auth-header">
          <i data-lucide="sprout" class="auth-logo-icon"></i>
          <h1>New Farm</h1>
        </div>
        <div class="auth-body">
          ${state.farms.length > 0 ? `<button class="btn-link" data-action="backToFarmSelect">← Back</button>` : ''}
          <div class="form-group">
            <label>Farm Name *</label>
            <input type="text" class="input" id="newFarmName" placeholder="e.g. Akhatar Vaadi" value="${esc(f.farmName)}">
          </div>
          <div class="form-group">
            <label>Jethi (Farmer) Name</label>
            <input type="text" class="input" id="newJethiName" placeholder="e.g. Rameshbhai" value="${esc(f.jethiName)}">
          </div>
          <div class="form-group">
            <label>Bhagyo (Partner) Name</label>
            <input type="text" class="input" id="newBhagyoName" placeholder="e.g. Maheshbhai" value="${esc(f.bhagyoName)}">
          </div>
          ${state.authError ? `<p class="error-text">${esc(state.authError)}</p>` : ''}
          <button class="btn btn-primary btn-block" data-action="saveFarm">Create Farm</button>
        </div>
      </div>
    </div>`;
}

// ── MAIN APP SCREEN ──────────────────────────────────────────

function renderApp() {
  const farm = getCurrentFarm();
  if (!farm) { state.screen = 'farmSelect'; return renderFarmSelect(); }

  const tabs = [
    { key: 'dashboard', icon: 'sprout', label: 'Dashboard' },
    { key: 'expenses', icon: 'wallet', label: 'Kharch' },
    { key: 'income', icon: 'trending-up', label: 'Aavak' },
    { key: 'udhar', icon: 'hand-coins', label: 'Udhar' },
    { key: 'settlement', icon: 'calculator', label: 'Vahenchani' },
    { key: 'history', icon: 'history', label: 'History' }
  ];

  const tabBar = tabs.map(t => `
    <button class="tab-btn ${state.activeTab === t.key ? 'active' : ''}" data-action="setTab" data-tab="${t.key}">
      <i data-lucide="${t.icon}" style="width:16px;height:16px;"></i>
      <span>${t.label}</span>
    </button>`).join('');

  let tabContent = '';
  switch (state.activeTab) {
    case 'dashboard':   tabContent = renderDashboard(farm); break;
    case 'expenses':    tabContent = renderExpenses(farm); break;
    case 'income':      tabContent = renderIncome(farm); break;
    case 'udhar':       tabContent = renderUdhar(farm); break;
    case 'settlement':  tabContent = renderSettlement(farm); break;
    case 'history':     tabContent = renderHistory(farm); break;
  }

  return `
    <div class="app-shell">
      <!-- Header -->
      <header class="app-header">
        <div class="header-left">
          <i data-lucide="sprout" class="header-logo"></i>
          <span class="header-title">KhetiKhata</span>
        </div>
        <div class="header-right">
          <span class="header-user">${esc(state.currentProfile.name)}</span>
          <button class="icon-btn" data-action="switchFarm" title="Switch Farm">
            <i data-lucide="arrow-left-right" style="width:18px;height:18px;"></i>
          </button>
          <button class="icon-btn" data-action="logout" title="Logout">
            <i data-lucide="log-out" style="width:18px;height:18px;"></i>
          </button>
        </div>
      </header>

      <!-- Farm Info Banner -->
      ${renderFarmBanner(farm)}

      <!-- Tabs -->
      <nav class="tab-bar">${tabBar}</nav>

      <!-- Tab Content -->
      <main class="tab-content">${tabContent}</main>
    </div>`;
}

// ── Farm Banner ──────────────────────────────────────────────

function renderFarmBanner(farm) {
  if (state.editingInfo) {
    const f = state.infoForm;
    return `
      <div class="farm-banner editing">
        <div class="form-row">
          <input type="text" class="input input-sm" id="editFarmName" placeholder="Farm Name" value="${esc(f.farmName)}">
          <input type="text" class="input input-sm" id="editJethiName" placeholder="Jethi" value="${esc(f.jethiName)}">
          <input type="text" class="input input-sm" id="editBhagyoName" placeholder="Bhagyo" value="${esc(f.bhagyoName)}">
        </div>
        <div class="banner-actions">
          <button class="icon-btn" data-action="saveInfo" title="Save"><i data-lucide="check" style="width:18px;height:18px;"></i></button>
          <button class="icon-btn" data-action="cancelInfo" title="Cancel"><i data-lucide="x" style="width:18px;height:18px;"></i></button>
        </div>
      </div>`;
  }
  return `
    <div class="farm-banner">
      <div class="banner-text">
        <strong>${esc(farm.farmName)}</strong>
        <span>${esc(farm.jethiName || '—')} &amp; ${esc(farm.bhagyoName || '—')}</span>
      </div>
      <button class="icon-btn" data-action="editInfo" title="Edit"><i data-lucide="pencil" style="width:16px;height:16px;"></i></button>
    </div>`;
}

// ── DASHBOARD TAB ────────────────────────────────────────────

function renderDashboard(farm) {
  const ue = getUnsettledExpenses(farm);
  const ui = getUnsettledIncomes(farm);
  const totalExp = getTotalExpense(ue);
  const totalInc = getTotalIncome(ui);
  const udharBal = getUdharGiven(farm) - getUdharRepaid(farm);
  const recent = getRecentActivity(farm);

  // Bhag system: Income split by %, Farmer bears kharch, Bhagyo has udhar deducted
  const farmerPct = Number(state.settleForm.jethiPercent) || 50;
  const bhagyoPct = 100 - farmerPct;
  const farmerGross = Math.round(totalInc * farmerPct / 100);
  const bhagyoGross = Math.round(totalInc * bhagyoPct / 100);
  const farmerNet = farmerGross - totalExp;
  const bhagyoNet = bhagyoGross - udharBal;
  const farmerNetClass = farmerNet >= 0 ? 'stat-green' : 'stat-red';
  const bhagyoNetClass = 'stat-amber';

  const activityList = recent.length === 0
    ? '<p class="empty-text">No activity yet.</p>'
    : recent.map(a => {
        let icon = '', label = '', amtClass = '';
        if (a._type === 'expense') { icon = 'wallet'; label = a.category || 'Expense'; amtClass = 'amt-red'; }
        else if (a._type === 'income') { icon = 'trending-up'; label = a.crop || 'Income'; amtClass = 'amt-green'; }
        else { icon = 'hand-coins'; label = `Udhar (${a.type})`; amtClass = a.type === 'given' ? 'amt-amber' : 'amt-green'; }
        return `
          <div class="activity-row">
            <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
            <div class="activity-info">
              <span class="activity-label">${esc(label)}</span>
              <span class="activity-date">${fmtDate(a.date)}</span>
            </div>
            <span class="activity-amt ${amtClass}">${fmt(a.amount)}</span>
          </div>`;
      }).join('');

  return `
    <div class="dashboard">
      <div class="stat-grid">
        <div class="stat-card stat-green">
          <div class="stat-icon"><i data-lucide="trending-up" style="width:22px;height:22px;"></i></div>
          <div class="stat-label">Total Aavak</div>
          <div class="stat-value">${fmt(totalInc)}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-icon"><i data-lucide="wallet" style="width:22px;height:22px;"></i></div>
          <div class="stat-label">Total Kharch</div>
          <div class="stat-value">${fmt(totalExp)}</div>
        </div>
        <div class="stat-card ${farmerNetClass}">
          <div class="stat-icon"><i data-lucide="sprout" style="width:22px;height:22px;"></i></div>
          <div class="stat-label">${esc(farm.jethiName || 'Farmer')} Net</div>
          <div class="stat-value">${fmt(farmerNet)}</div>
        </div>
        <div class="stat-card ${bhagyoNetClass}">
          <div class="stat-icon"><i data-lucide="hand-coins" style="width:22px;height:22px;"></i></div>
          <div class="stat-label">${esc(farm.bhagyoName || 'Bhagyo')} Net</div>
          <div class="stat-value">${fmt(bhagyoNet)}</div>
        </div>
      </div>
      <div class="section-card">
        <h3 class="section-title">Recent Activity</h3>
        ${activityList}
      </div>
    </div>`;
}

// ── EXPENSES TAB ─────────────────────────────────────────────

function renderExpenses(farm) {
  const f = state.expForm;
  const unsettled = getUnsettledExpenses(farm);
  const total = getTotalExpense(unsettled);

  const catOptions = EXPENSE_CATEGORIES.map(c => `<option value="${esc(c)}" ${f.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('');

  const rows = unsettled.length === 0
    ? '<p class="empty-text">No expenses yet.</p>'
    : unsettled.map(e => renderDeleteRow(e, 'expense', `
        <div class="entry-main">
          <span class="entry-cat">${esc(e.category)}</span>
          <span class="entry-amt amt-red">${fmt(e.amount)}</span>
        </div>
        <div class="entry-meta">${fmtDate(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</div>
      `)).join('');

  return `
    <div class="tab-section">
      <div class="section-card">
        <h3 class="section-title"><i data-lucide="plus" style="width:16px;height:16px;"></i> Add Expense</h3>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Date</label>
            <input type="date" class="input" id="expDate" value="${f.date}">
          </div>
          <div class="form-group flex-1">
            <label>Category</label>
            <select class="input" id="expCategory">${catOptions}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Amount (₹)</label>
            <input type="number" class="input" id="expAmount" placeholder="0" value="${esc(f.amount)}">
          </div>
          <div class="form-group flex-1">
            <label>Note</label>
            <input type="text" class="input" id="expNote" placeholder="Optional" value="${esc(f.note)}">
          </div>
        </div>
        <button class="btn btn-primary btn-block" data-action="addExpense" ${!f.amount ? 'disabled' : ''}>
          <i data-lucide="plus" style="width:16px;height:16px;"></i> Add Expense
        </button>
      </div>
      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Expenses (Unsettled)</h3>
          <span class="section-total amt-red">${fmt(total)}</span>
        </div>
        ${rows}
      </div>
    </div>`;
}

// ── INCOME TAB ───────────────────────────────────────────────

function renderIncome(farm) {
  const f = state.incForm;
  const unsettled = getUnsettledIncomes(farm);
  const total = getTotalIncome(unsettled);
  const calcAmount = (Number(f.qty) || 0) * (Number(f.rate) || 0);

  const unitOptions = UNITS.map(u => `<option value="${esc(u)}" ${f.unit === u ? 'selected' : ''}>${esc(u)}</option>`).join('');

  const rows = unsettled.length === 0
    ? '<p class="empty-text">No income yet.</p>'
    : unsettled.map(i => renderDeleteRow(i, 'income', `
        <div class="entry-main">
          <span class="entry-cat">${esc(i.crop)}</span>
          <span class="entry-amt amt-green">${fmt(i.amount)}</span>
        </div>
        <div class="entry-meta">${fmtDate(i.date)} · ${i.qty} ${esc(i.unit)} × ${fmt(i.rate)}${i.note ? ' · ' + esc(i.note) : ''}</div>
      `)).join('');

  return `
    <div class="tab-section">
      <div class="section-card">
        <h3 class="section-title"><i data-lucide="plus" style="width:16px;height:16px;"></i> Add Income</h3>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Crop Name</label>
            <input type="text" class="input" id="incCrop" placeholder="e.g. Kapas" value="${esc(f.crop)}">
          </div>
          <div class="form-group flex-1">
            <label>Date</label>
            <input type="date" class="input" id="incDate" value="${f.date}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Unit</label>
            <select class="input" id="incUnit">${unitOptions}</select>
          </div>
          <div class="form-group flex-1">
            <label>Quantity</label>
            <input type="number" class="input" id="incQty" placeholder="0" value="${esc(f.qty)}">
          </div>
          <div class="form-group flex-1">
            <label>Rate / Unit (₹)</label>
            <input type="number" class="input" id="incRate" placeholder="0" value="${esc(f.rate)}">
          </div>
        </div>
        <div class="calc-preview">Total: <strong>${fmt(calcAmount)}</strong></div>
        <div class="form-group">
          <label>Note</label>
          <input type="text" class="input" id="incNote" placeholder="Optional" value="${esc(f.note)}">
        </div>
        <button class="btn btn-primary btn-block" data-action="addIncome" ${!(f.crop && f.qty && f.rate) ? 'disabled' : ''}>
          <i data-lucide="plus" style="width:16px;height:16px;"></i> Add Income
        </button>
      </div>
      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Income (Unsettled)</h3>
          <span class="section-total amt-green">${fmt(total)}</span>
        </div>
        ${rows}
      </div>
    </div>`;
}

// ── UDHAR TAB ────────────────────────────────────────────────

function renderUdhar(farm) {
  const f = state.udharForm;
  const udharGiven = getUdharGiven(farm);
  const udharRepaid = getUdharRepaid(farm);
  const udharBal = udharGiven - udharRepaid;
  const sorted = getSortedUdhars(farm);

  const rows = sorted.length === 0
    ? '<p class="empty-text">No udhar entries.</p>'
    : sorted.map(u => renderDeleteRow(u, 'udhar', `
        <div class="entry-main">
          <span class="entry-cat udhar-type-${u.type}">${u.type === 'given' ? '↑ Given' : '↓ Repaid'}</span>
          <span class="entry-amt ${u.type === 'given' ? 'amt-amber' : 'amt-green'}">${fmt(u.amount)}</span>
        </div>
        <div class="entry-meta">${fmtDate(u.date)}${u.note ? ' · ' + esc(u.note) : ''}</div>
      `)).join('');

  return `
    <div class="tab-section">
      <div class="udhar-balance-banner">
        <span>Udhar Balance</span>
        <strong>${fmt(udharBal)}</strong>
      </div>
      <div class="section-card">
        <h3 class="section-title"><i data-lucide="plus" style="width:16px;height:16px;"></i> Add Udhar</h3>
        <div class="toggle-row">
          <button class="toggle-btn ${f.type === 'given' ? 'active given' : ''}" data-action="setUdharType" data-type="given">Given</button>
          <button class="toggle-btn ${f.type === 'repaid' ? 'active repaid' : ''}" data-action="setUdharType" data-type="repaid">Repaid</button>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Date</label>
            <input type="date" class="input" id="udharDate" value="${f.date}">
          </div>
          <div class="form-group flex-1">
            <label>Amount (₹)</label>
            <input type="number" class="input" id="udharAmount" placeholder="0" value="${esc(f.amount)}">
          </div>
        </div>
        <div class="form-group">
          <label>Note</label>
          <input type="text" class="input" id="udharNote" placeholder="Optional" value="${esc(f.note)}">
        </div>
        <button class="btn btn-primary btn-block" data-action="addUdhar" ${!f.amount ? 'disabled' : ''}>
          <i data-lucide="plus" style="width:16px;height:16px;"></i> Add Udhar
        </button>
      </div>
      <div class="section-card">
        <h3 class="section-title">Udhar Ledger</h3>
        ${rows}
      </div>
    </div>`;
}

// ── SETTLEMENT TAB ───────────────────────────────────────────

function renderSettlement(farm) {
  const ue = getUnsettledExpenses(farm);
  const ui = getUnsettledIncomes(farm);
  const totalExp = getTotalExpense(ue);
  const totalInc = getTotalIncome(ui);
  const udharBal = getUdharGiven(farm) - getUdharRepaid(farm);

  const f = state.settleForm;
  const jethiPct = Number(f.jethiPercent) || 0;
  const bhagyoPct = 100 - jethiPct;

  // Bhag system: split INCOME (not profit), Farmer bears kharch, Bhagyo has udhar deducted
  const jethiShare = Math.round(totalInc * jethiPct / 100);
  const bhagyoShare = Math.round(totalInc * bhagyoPct / 100);
  const farmerNet = jethiShare - totalExp;

  const deductAmt = f.deductUdhar ? (Number(f.deductAmount) || 0) : 0;
  const finalBhagyo = bhagyoShare - deductAmt;

  const hasEntries = ue.length > 0 || ui.length > 0;

  return `
    <div class="tab-section">
      <div class="section-card">
        <h3 class="section-title"><i data-lucide="calculator" style="width:16px;height:16px;"></i> Current Period Summary</h3>
        <div class="summary-cols">
          <div class="summary-col">
            <span class="summary-label">Aavak</span>
            <span class="summary-value amt-green">${fmt(totalInc)}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Kharch</span>
            <span class="summary-value amt-red">${fmt(totalExp)}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Udhar</span>
            <span class="summary-value amt-amber">${fmt(udharBal)}</span>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h3 class="section-title">Farmer Share %</h3>
        <div class="form-group">
          <label>Jethi (Farmer) %</label>
          <input type="number" class="input" id="settlePercent" min="0" max="100" value="${jethiPct}">
        </div>
      </div>

      <div class="share-preview">
        <div class="share-card share-farmer">
          <h4>${esc(farm.jethiName || 'Farmer')} (${jethiPct}%)</h4>
          <div class="share-amount">${fmt(jethiShare)}</div>
          <div class="deduct-note">Kharch: ${fmt(totalExp)}</div>
          <div class="deduct-note"><strong>Net: ${fmt(farmerNet)}</strong></div>
        </div>
        <div class="share-card share-bhagyo">
          <h4>${esc(farm.bhagyoName || 'Bhagyo')} (${bhagyoPct}%)</h4>
          <div class="share-amount">${fmt(bhagyoShare)}</div>
          ${deductAmt > 0 ? `<div class="deduct-note">Udhar: ${fmt(deductAmt)}</div>` : ''}
          ${deductAmt > 0 ? `<div class="deduct-note"><strong>Net: ${fmt(finalBhagyo)}</strong></div>` : ''}
        </div>
      </div>

      <div class="section-card">
        <h3 class="section-title">Udhar Deduction</h3>
        <label class="checkbox-label">
          <input type="checkbox" id="settleDeductUdhar" ${f.deductUdhar ? 'checked' : ''}>
          Deduct Udhar from Bhagyo's share
        </label>
        ${f.deductUdhar ? `
          <div class="form-group" style="margin-top:8px;">
            <label>Deduction Amount (Balance: ${fmt(udharBal)})</label>
            <input type="number" class="input" id="settleDeductAmt" value="${esc(f.deductAmount)}" placeholder="0">
          </div>
          <div class="final-bhagyo">Final Bhagyo Amount: <strong>${fmt(finalBhagyo)}</strong></div>
        ` : ''}
      </div>

      <div class="section-card">
        <div class="form-group">
          <label>Note</label>
          <input type="text" class="input" id="settleNote" placeholder="Optional settlement note" value="${esc(f.note)}">
        </div>
        ${state.saveError ? '<p class="error-text">Could not save. Check entries.</p>' : ''}
        <button class="btn btn-primary btn-block" data-action="saveSettlement" ${!hasEntries ? 'disabled' : ''}>
          <i data-lucide="check" style="width:16px;height:16px;"></i> Save Settlement
        </button>
      </div>
    </div>`;
}

// ── HISTORY TAB ──────────────────────────────────────────────

function renderHistory(farm) {
  const settlements = getSortedSettlements(farm);
  if (settlements.length === 0) {
    return '<div class="tab-section"><p class="empty-text">No settlements yet.</p></div>';
  }

  const cards = settlements.map(s => {
    const isOpen = state.expandedSettlement === s.id;
    // Find related expenses and incomes by settlementId
    const relExpenses = farm.expenses.filter(e => e.settlementId === s.id);
    const relIncomes = farm.incomes.filter(i => i.settlementId === s.id);

    let detail = '';
    if (isOpen) {
      const expRows = relExpenses.length === 0
        ? '<p class="empty-text">No expenses.</p>'
        : relExpenses.map(e => `
            <div class="history-entry">
              <span>${esc(e.category)} — ${fmtDate(e.date)}</span>
              <span class="amt-red">${fmt(e.amount)}</span>
            </div>`).join('');
      const incRows = relIncomes.length === 0
        ? '<p class="empty-text">No income.</p>'
        : relIncomes.map(i => `
            <div class="history-entry">
              <span>${esc(i.crop)} — ${fmtDate(i.date)}</span>
              <span class="amt-green">${fmt(i.amount)}</span>
            </div>`).join('');

      detail = `
        <div class="history-detail">
          <div class="share-preview" style="margin-bottom:12px;">
            <div class="share-card share-farmer">
              <h4>${esc(s.jethiName || 'Farmer')} (${s.jethiPercent}%)</h4>
              <div class="share-amount">${fmt(s.jethiShare)}</div>
              <div class="deduct-note">Kharch: ${fmt(s.totalExpense)}</div>
              <div class="deduct-note"><strong>Net: ${fmt(s.farmerNet != null ? s.farmerNet : s.jethiShare - s.totalExpense)}</strong></div>
            </div>
            <div class="share-card share-bhagyo">
              <h4>${esc(s.bhagyoName || 'Bhagyo')} (${s.bhagyoPercent}%)</h4>
              <div class="share-amount">${fmt(s.bhagyoShare)}</div>
              ${s.deductAmount ? `<div class="deduct-note">Udhar: ${fmt(s.deductAmount)}</div>` : ''}
              <div class="deduct-note"><strong>Net: ${fmt(s.finalBhagyo != null ? s.finalBhagyo : s.bhagyoShare - (s.deductAmount || 0))}</strong></div>
            </div>
          </div>
          <h4 class="history-sub">Expenses (${relExpenses.length})</h4>
          ${expRows}
          <h4 class="history-sub">Income (${relIncomes.length})</h4>
          ${incRows}
          ${s.note ? `<p class="history-note">Note: ${esc(s.note)}</p>` : ''}
        </div>`;
    }

    return `
      <div class="section-card history-card">
        <button class="history-header" data-action="toggleSettlement" data-id="${s.id}">
          <div>
            <div class="history-title">${fmtDate(s.date)}</div>
            <div class="history-meta">Aavak: ${fmt(s.totalIncome)} · Kharch: ${fmt(s.totalExpense)}</div>
          </div>
          <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" style="width:18px;height:18px;"></i>
        </button>
        ${detail}
      </div>`;
  }).join('');

  return `<div class="tab-section">${cards}</div>`;
}

// ── Delete Row with Confirmation ─────────────────────────────

function renderDeleteRow(entry, type, innerHtml) {
  const isConfirming = state.confirmDelete === entry.id;
  return `
    <div class="entry-row">
      <div class="entry-content">${innerHtml}</div>
      <div class="entry-actions">
        ${isConfirming ? `
          <button class="icon-btn icon-confirm" data-action="confirmDel" data-type="${type}" data-id="${entry.id}" title="Confirm">
            <i data-lucide="check" style="width:16px;height:16px;"></i>
          </button>
          <button class="icon-btn icon-cancel" data-action="cancelDel" title="Cancel">
            <i data-lucide="x" style="width:16px;height:16px;"></i>
          </button>
        ` : `
          <button class="icon-btn icon-delete" data-action="startDel" data-id="${entry.id}" title="Delete">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
          </button>
        `}
      </div>
    </div>`;
}

// ── HTML Escape ──────────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Event Binding ────────────────────────────────────────────
// After each render, we attach event listeners via delegation + direct binding.

function bindEvents() {
  // ─── Delegated click events (data-action) ───
  document.getElementById('app').addEventListener('click', handleClick);

  // ─── Input change listeners for forms ───
  bindInput('pinInput', v => { state.pinInput = v; });
  bindInput('newNameInput', v => { state.newName = v; });
  bindInput('newPinInput', v => { state.newPin = v; });
  bindInput('newPin2Input', v => { state.newPin2 = v; });

  bindInput('newFarmName', v => { state.newFarmForm.farmName = v; });
  bindInput('newJethiName', v => { state.newFarmForm.jethiName = v; });
  bindInput('newBhagyoName', v => { state.newFarmForm.bhagyoName = v; });

  bindInput('editFarmName', v => { state.infoForm.farmName = v; });
  bindInput('editJethiName', v => { state.infoForm.jethiName = v; });
  bindInput('editBhagyoName', v => { state.infoForm.bhagyoName = v; });

  bindInput('expDate', v => { state.expForm.date = v; });
  bindInput('expCategory', v => { state.expForm.category = v; });
  bindInput('expAmount', v => { state.expForm.amount = v; });
  bindInput('expNote', v => { state.expForm.note = v; });

  bindInput('incCrop', v => { state.incForm.crop = v; });
  bindInput('incDate', v => { state.incForm.date = v; });
  bindInput('incUnit', v => { state.incForm.unit = v; });
  bindInput('incQty', v => { state.incForm.qty = v; });
  bindInput('incRate', v => { state.incForm.rate = v; });
  bindInput('incNote', v => { state.incForm.note = v; });

  bindInput('udharDate', v => { state.udharForm.date = v; });
  bindInput('udharAmount', v => { state.udharForm.amount = v; });
  bindInput('udharNote', v => { state.udharForm.note = v; });

  bindInput('settlePercent', v => { state.settleForm.jethiPercent = v; });
  bindInput('settleNote', v => { state.settleForm.note = v; });
  bindInput('settleDeductAmt', v => { state.settleForm.deductAmount = v; });

  // Checkbox for udhar deduction
  const chk = document.getElementById('settleDeductUdhar');
  if (chk) {
    chk.addEventListener('change', () => {
      const farm = getCurrentFarm();
      state.settleForm.deductUdhar = chk.checked;
      if (chk.checked && !state.settleForm.deductAmount) {
        const bal = getUdharGiven(farm) - getUdharRepaid(farm);
        state.settleForm.deductAmount = bal > 0 ? String(bal) : '';
      }
      render();
    });
  }

  // Enter key on PIN inputs
  const pinEl = document.getElementById('pinInput');
  if (pinEl) pinEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleAction('loginPin'); });
}

/** Bind an input/select element to update state on change without re-rendering */
function bindInput(id, setter) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => setter(el.value));
  el.addEventListener('change', () => setter(el.value));
}

// ── Click Action Router ──────────────────────────────────────

function handleClick(e) {
  // Walk up from target to find the closest element with data-action
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  handleAction(action, btn.dataset);
}

function handleAction(action, dataset) {
  dataset = dataset || {};

  switch (action) {
    // ─── Auth ───
    case 'selectProfile': {
      const p = state.profiles.find(pr => pr.id === dataset.id);
      if (p) {
        state.selectedLoginProfile = p;
        state.authMode = 'pin';
        state.pinInput = '';
        state.authError = '';
      }
      render();
      break;
    }
    case 'goCreateProfile':
      state.authMode = 'create';
      state.newName = '';
      state.newPin = '';
      state.newPin2 = '';
      state.authError = '';
      render();
      break;
    case 'backToSelect':
      state.authMode = 'select';
      state.authError = '';
      state.pinInput = '';
      render();
      break;
    case 'loginPin': {
      const p = state.selectedLoginProfile;
      if (!p) break;
      if (state.pinInput !== p.pin) {
        state.authError = 'Wrong PIN. Try again.';
        state.pinInput = '';
        render();
        break;
      }
      // Successful login
      state.currentProfile = p;
      state.farms = loadFarms(p.id);
      state.authError = '';
      state.pinInput = '';
      if (state.farms.length > 0) {
        state.screen = 'farmSelect';
      } else {
        state.screen = 'createFarm';
        state.newFarmForm = { farmName: '', jethiName: '', bhagyoName: '' };
      }
      render();
      break;
    }
    case 'createProfile': {
      const name = state.newName.trim();
      const pin = state.newPin.trim();
      const pin2 = state.newPin2.trim();
      if (!name) { state.authError = 'Name is required.'; render(); break; }
      if (!/^\d{4}$/.test(pin)) { state.authError = 'PIN must be exactly 4 digits.'; render(); break; }
      if (pin !== pin2) { state.authError = 'PINs do not match.'; render(); break; }
      if (state.profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        state.authError = 'A profile with this name already exists.';
        render();
        break;
      }
      const newProfile = { id: genId(), name, pin };
      state.profiles.push(newProfile);
      persistProfiles(state.profiles);
      state.currentProfile = newProfile;
      state.farms = [];
      state.screen = 'createFarm';
      state.newFarmForm = { farmName: '', jethiName: '', bhagyoName: '' };
      state.authError = '';
      render();
      break;
    }

    // ─── Farm Select / Create ───
    case 'selectFarm': {
      state.currentFarmId = dataset.id;
      state.screen = 'app';
      state.activeTab = 'dashboard';
      resetFormStates();
      render();
      break;
    }
    case 'goCreateFarm':
      state.screen = 'createFarm';
      state.newFarmForm = { farmName: '', jethiName: '', bhagyoName: '' };
      state.authError = '';
      render();
      break;
    case 'backToFarmSelect':
      state.screen = 'farmSelect';
      state.authError = '';
      render();
      break;
    case 'saveFarm': {
      const fn = state.newFarmForm.farmName.trim();
      if (!fn) { state.authError = 'Farm name is required.'; render(); break; }
      const farm = emptyFarm(fn, state.newFarmForm.jethiName.trim(), state.newFarmForm.bhagyoName.trim());
      state.farms.push(farm);
      persistFarms(state.farms);
      state.currentFarmId = farm.id;
      state.screen = 'app';
      state.activeTab = 'dashboard';
      state.authError = '';
      resetFormStates();
      render();
      break;
    }

    // ─── Logout / Switch Farm ───
    case 'logout':
      state.screen = 'auth';
      state.authMode = state.profiles.length > 0 ? 'select' : 'create';
      state.currentProfile = null;
      state.currentFarmId = null;
      state.farms = [];
      state.authError = '';
      state.pinInput = '';
      render();
      break;
    case 'switchFarm':
      state.screen = 'farmSelect';
      state.currentFarmId = null;
      render();
      break;

    // ─── Tabs ───
    case 'setTab':
      state.activeTab = dataset.tab;
      state.confirmDelete = null;
      render();
      break;

    // ─── Farm Banner Edit ───
    case 'editInfo': {
      const farm = getCurrentFarm();
      state.editingInfo = true;
      state.infoForm = { farmName: farm.farmName, jethiName: farm.jethiName, bhagyoName: farm.bhagyoName };
      render();
      break;
    }
    case 'saveInfo': {
      const name = state.infoForm.farmName.trim();
      if (!name) break;
      updateFarm(state.currentFarmId, f => ({
        ...f,
        farmName: name,
        jethiName: state.infoForm.jethiName.trim(),
        bhagyoName: state.infoForm.bhagyoName.trim()
      }));
      state.editingInfo = false;
      render();
      break;
    }
    case 'cancelInfo':
      state.editingInfo = false;
      render();
      break;

    // ─── Expense CRUD ───
    case 'addExpense': {
      const f = state.expForm;
      if (!f.amount) break;
      const entry = {
        id: genId(),
        date: f.date,
        category: f.category,
        amount: Number(f.amount) || 0,
        note: f.note,
        settled: false,
        settlementId: null
      };
      updateFarm(state.currentFarmId, farm => ({ ...farm, expenses: [...farm.expenses, entry] }));
      state.expForm = { date: todayStr(), category: EXPENSE_CATEGORIES[0], amount: '', note: '' };
      render();
      break;
    }

    // ─── Income CRUD ───
    case 'addIncome': {
      const f = state.incForm;
      if (!f.crop || !f.qty || !f.rate) break;
      const amount = (Number(f.qty) || 0) * (Number(f.rate) || 0);
      const entry = {
        id: genId(),
        date: f.date,
        crop: f.crop,
        qty: Number(f.qty),
        unit: f.unit,
        rate: Number(f.rate),
        amount,
        note: f.note,
        settled: false,
        settlementId: null
      };
      updateFarm(state.currentFarmId, farm => ({ ...farm, incomes: [...farm.incomes, entry] }));
      state.incForm = { date: todayStr(), crop: '', qty: '', unit: UNITS[0], rate: '', note: '' };
      render();
      break;
    }

    // ─── Udhar CRUD ───
    case 'setUdharType':
      state.udharForm.type = dataset.type;
      render();
      break;
    case 'addUdhar': {
      const f = state.udharForm;
      if (!f.amount) break;
      const entry = {
        id: genId(),
        date: f.date,
        type: f.type,
        amount: Number(f.amount) || 0,
        note: f.note
      };
      updateFarm(state.currentFarmId, farm => ({ ...farm, udhars: [...farm.udhars, entry] }));
      state.udharForm = { date: todayStr(), type: 'given', amount: '', note: '' };
      render();
      break;
    }

    // ─── Delete (all types) ───
    case 'startDel':
      state.confirmDelete = dataset.id;
      render();
      break;
    case 'cancelDel':
      state.confirmDelete = null;
      render();
      break;
    case 'confirmDel': {
      const type = dataset.type;
      const id = dataset.id;
      updateFarm(state.currentFarmId, farm => {
        if (type === 'expense') return { ...farm, expenses: farm.expenses.filter(e => e.id !== id) };
        if (type === 'income') return { ...farm, incomes: farm.incomes.filter(i => i.id !== id) };
        if (type === 'udhar') return { ...farm, udhars: farm.udhars.filter(u => u.id !== id) };
        return farm;
      });
      state.confirmDelete = null;
      render();
      break;
    }

    // ─── Settlement ───
    case 'saveSettlement': {
      const farm = getCurrentFarm();
      if (!farm) break;
      const ue = getUnsettledExpenses(farm);
      const ui = getUnsettledIncomes(farm);
      if (ue.length === 0 && ui.length === 0) break;

      const totalExp = getTotalExpense(ue);
      const totalInc = getTotalIncome(ui);
      const jethiPct = Number(state.settleForm.jethiPercent) || 0;
      const bhagyoPct = 100 - jethiPct;
      // Bhag system: split INCOME, not profit
      const jethiShare = Math.round(totalInc * jethiPct / 100);
      const bhagyoShare = Math.round(totalInc * bhagyoPct / 100);
      const farmerNet = jethiShare - totalExp;
      const deductAmt = state.settleForm.deductUdhar ? (Number(state.settleForm.deductAmount) || 0) : 0;
      const finalBhagyo = bhagyoShare - deductAmt;

      const settlementId = genId();
      const settlement = {
        id: settlementId,
        date: todayStr(),
        totalExpense: totalExp,
        totalIncome: totalInc,
        jethiPercent: jethiPct,
        bhagyoPercent: bhagyoPct,
        jethiShare,
        bhagyoShare,
        farmerNet,
        deductAmount: deductAmt,
        finalBhagyo,
        jethiName: farm.jethiName,
        bhagyoName: farm.bhagyoName,
        note: state.settleForm.note
      };

      updateFarm(state.currentFarmId, fm => {
        // Mark all unsettled expenses/incomes as settled
        const expenses = fm.expenses.map(e =>
          !e.settled ? { ...e, settled: true, settlementId } : e
        );
        const incomes = fm.incomes.map(i =>
          !i.settled ? { ...i, settled: true, settlementId } : i
        );
        let udhars = [...fm.udhars];
        // If deduction > 0, add a repaid udhar entry
        if (deductAmt > 0) {
          udhars = [...udhars, {
            id: genId(),
            date: todayStr(),
            type: 'repaid',
            amount: deductAmt,
            note: `Settlement deduction — ${settlement.id}`
          }];
        }
        return {
          ...fm,
          expenses,
          incomes,
          udhars,
          settlements: [...fm.settlements, settlement]
        };
      });

      // Reset settle form
      state.settleForm = { note: '', jethiPercent: 50, deductUdhar: false, deductAmount: '' };
      state.activeTab = 'history';
      state.expandedSettlement = settlementId;
      render();
      break;
    }

    // ─── History Accordion ───
    case 'toggleSettlement':
      state.expandedSettlement = state.expandedSettlement === dataset.id ? null : dataset.id;
      render();
      break;
  }
}

// ── Reset Form States ────────────────────────────────────────

function resetFormStates() {
  state.editingInfo = false;
  state.expForm = { date: todayStr(), category: EXPENSE_CATEGORIES[0], amount: '', note: '' };
  state.incForm = { date: todayStr(), crop: '', qty: '', unit: UNITS[0], rate: '', note: '' };
  state.udharForm = { date: todayStr(), type: 'given', amount: '', note: '' };
  state.settleForm = { note: '', jethiPercent: 50, deductUdhar: false, deductAmount: '' };
  state.confirmDelete = null;
  state.expandedSettlement = null;
  state.saveError = false;
}

// ── Initialization ───────────────────────────────────────────

function init() {
  state.profiles = loadProfiles();
  if (state.profiles.length > 0) {
    state.authMode = 'select';
  } else {
    state.authMode = 'create';
  }
  render();
}

// Boot the app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
