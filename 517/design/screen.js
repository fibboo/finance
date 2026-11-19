const parameters = new URLSearchParams(location.search);
document.documentElement.dataset.variant = parameters.get('variant') ?? 'b';
const state = parameters.get('state') ?? 'estimated';
const hasEstimates = state === 'estimated';
const hasUnvalued = state !== 'settled';
document.documentElement.dataset.theme = parameters.get('theme') === 'light' ? 'light' : 'dark';

const paths = {
  home: '<path d="m3 10 7-7 7 7v8h-5v-5H8v5H3z"/>',
  transactions: '<path d="M7 5h11M7 10h11M7 15h11"/><path d="M3 5h.01M3 10h.01M3 15h.01"/>',
  accounts: '<rect x="2" y="4" width="17" height="13" rx="3"/><path d="M2 8h17m-5 5h2"/>',
  categories: '<path d="M3 3h7l9 9-7 7-9-9z"/><circle cx="7" cy="7" r=".7"/>',
  locations: '<path d="M17 8c0 5-7 11-7 11S3 13 3 8a7 7 0 0 1 14 0z"/><circle cx="10" cy="8" r="2"/>',
  income: '<path d="M3 13v5h14v-5M10 2v11m-4-4 4 4 4-4"/>',
  add: '<path d="M10 3v14M3 10h14"/>',
  more: '<circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/>',
  chevron: '<path d="m8 4 6 6-6 6"/>',
};
function icon(name) { return `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true">${paths[name]}</svg>`; }
function source() { return '<a class="source" href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API ↗</a>'; }
function account({ name, code, mark, style, base, original, estimate }) {
  const primary = hasEstimates && estimate ? `≈ ${estimate}` : base;
  const primaryClass = hasEstimates && estimate ? 'estimated' : '';
  const valuedLabel = !hasEstimates && code !== 'USD' ? ' · valued' : '';
  return `<article class="card"><a class="card-main" href="#account"><span class="card-title">${name}</span><span class="mark ${style}">${mark}</span><span class="card-code">${code}</span><span class="card-amounts"><span class="card-primary ${primaryClass}">${primary}${valuedLabel ? '<small class="card-secondary"> valued</small>' : ''}</span><span class="card-secondary ${style === 'credit' ? 'debt' : ''}">${original}</span></span></a></article>`;
}
function transaction({ title, accountName, original, base, estimated, color = '', income = false }) {
  const amount = estimated && hasUnvalued ? (hasEstimates ? `≈ ${estimated}` : original) : base;
  const originalLine = estimated && hasUnvalued && !hasEstimates ? '' : `<span class="original">${original}</span>`;
  return `<div class="tx ${income ? 'income-row' : ''}"><span class="dot ${color}"></span><div class="tx-copy"><a href="#transaction" class="tx-title">${title}</a><div class="tx-note">${accountName}</div></div><div class="tx-amounts"><span class="tx-amount ${estimated && hasEstimates ? 'estimated' : ''}">${amount}</span>${originalLine}</div></div>`;
}
const totalAmount = hasEstimates ? '≈ $2,326.00' : hasUnvalued ? '$2,650.00' : '$2,332.00';
const totalExtra = hasEstimates ? `<div class="rates"><ul aria-label="Applied exchange rates"><li>1 EUR = $1.08</li><li>1 GBP = $1.27</li></ul><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" aria-label="ExchangeRate-API (opens in a new tab)">ExchangeRate-API</a></div>` : '';
const unvalued = !hasUnvalued ? '' : `<div class="unvalued"><span>Unvalued spending</span><span class="estimate">${hasEstimates ? '≈ −$324.00' : 'No estimate available'}</span><span class="original">€300.00</span>${hasEstimates ? '' : '<p class="month-hint">Not included in Spent or Left. Estimates are unavailable.</p>'}</div>`;
const monthSpent = hasUnvalued ? '1,200.00' : '1,518.00';
const monthLeft = hasUnvalued ? '1,800.00' : '1,482.00';
document.querySelector('#app').innerHTML = `
<div class="shell">
  <nav class="sidebar" aria-label="Main"><span class="logo-dot"></span><a href="#new" class="side-item add" aria-label="New transaction">${icon('add')}</a>${['home','transactions','accounts','categories','locations','income'].map((name) => `<a href="#${name}" class="side-item ${name === 'home' ? 'on' : ''}" aria-label="${name}">${icon(name)}</a>`).join('')}<span class="side-divider"></span><a class="side-item" href="#collapse" aria-label="Expand menu">${icon('chevron')}</a></nav>
  <main class="main">
    <header class="topbar"><span class="logo phone-logo"><i class="logo-dot"></i>fibboo</span><span class="desktop-title">Home</span><span class="avatar">TE</span></header>
    <div class="home">
      <div class="summaries">
        <section class="panel accounts-panel" aria-label="Accounts">
          <div class="accounts-header"><div class="total"><span class="label">Total balance · USD</span><span class="total-amount ${hasEstimates ? 'estimated' : ''}">${totalAmount}</span></div>${totalExtra}<a href="#accounts" class="all">All</a></div>
          <div class="cards">${account({name:'Credit EUR',code:'EUR',mark:'C',style:'credit',base:hasUnvalued?'$0.00':'−$318.00',original:'−€300.00',estimate:'−$324.00'})}${account({name:'Daily account',code:'USD',mark:'D',style:'',base:'$2,400.00',original:'USD',estimate:null})}${account({name:'Cash',code:'USD',mark:'C',style:'cash',base:'$250.00',original:'USD',estimate:null})}</div>
        </section>
        <section class="panel month" aria-label="This month">
          <div class="panel-heading"><h2>This month</h2><span class="left">Left <strong>$${monthLeft}</strong></span></div>
          <div class="track"><div class="track-fill"></div><i class="today"></i></div>
          <div class="legend"><span>Spent <strong>−$${monthSpent}</strong></span><span>Earned <strong class="income">+$3,000.00</strong></span></div>
          ${unvalued}
        </section>
      </div>
      <section class="panel feed" aria-label="Recent transactions">
        <div class="panel-heading"><h2>Recent transactions</h2><a href="#transactions" class="all">All</a></div>
        <div class="day"><span>Today</span><span>${hasUnvalued ? '$0.00 · valued' : '−$318.00'}</span></div>
        ${transaction({title:'Groceries',accountName:'Credit EUR · EUR',original:'−€120.00',base:'−$127.20',estimated:'−$129.60'})}
        ${transaction({title:'Eating out',accountName:'Credit EUR · EUR',original:'−€180.00',base:'−$190.80',estimated:'−$194.40'})}
        <div class="day"><span>Yesterday</span><span>−$38.00</span></div>
        ${transaction({title:'Transport',accountName:'Daily account · USD',original:'',base:'−$38.00',color:'bank'})}
        <div class="day"><span>Mon, 16.11.2026</span><span>+$3,000.00</span></div>
        ${transaction({title:'Salary',accountName:'Daily account · USD',original:'',base:'+$3,000.00',color:'bank',income:true})}
      </section>
      <aside class="panel details" aria-label="Transaction details">
        <div class="detail-meta">Expense · Tue, 17.11.2026</div><h2>Transport</h2><div class="detail-amount">−$38.00</div>
        <div class="block-label">From</div><div class="entry"><span class="entry-mark">D</span><div class="entry-copy"><strong>Daily account ›</strong><span>Asset · USD<br>Balance $2,400.00</span></div><span class="entry-amount">−$38.00</span></div>
        <div class="block-label">To</div><div class="entry"><span class="entry-mark" style="background:var(--color-bone);color:var(--color-muted)">T</span><div class="entry-copy"><strong>Transport ›</strong><span>Expense · Variable</span></div><span class="entry-amount">+$38.00</span></div>
        <dl class="facts"><dt>Location</dt><dd>Metro ›</dd><dt>Comment</dt><dd>—</dd></dl><div class="actions"><button type="button">Edit</button><button type="button">Delete</button></div>
      </aside>
    </div>
  </main>
  <nav class="bottom-nav" aria-label="Main"><a href="#home" class="nav-item on">${icon('home')}Home</a><a href="#transactions" class="nav-item">${icon('transactions')}Transactions</a><a href="#new" class="nav-item new-item" aria-label="New transaction"><span>${icon('add')}</span></a><a href="#accounts" class="nav-item">${icon('accounts')}Accounts</a><a href="#more" class="nav-item">${icon('more')}More</a></nav>
</div>`;
