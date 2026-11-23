const params=new URLSearchParams(location.search);
const screen=params.get('screen')||'home';
const variant=params.get('variant')||'a';
const state=params.get('state')||'normal';
document.documentElement.dataset.theme=params.get('theme')==='light'?'light':'dark';
let purpose='INCOME_COST',categoryType='FIXED',purposeFilter='all';
const icons={Home:'⌂',Transactions:'⇄',Categories:'▦','Income sources':'↙',Accounts:'▣',Locations:'⌖',More:'•••'};
function navigate(target){if(window.parent!==window)window.parent.postMessage({screen:target},location.origin);else{params.set('screen',target);location.search=params.toString();}}
function nav(label,target,active){return '<a href="?screen='+target+'&variant='+variant+'&theme='+document.documentElement.dataset.theme+'" data-screen="'+target+'" class="nav-item '+(active?'active':'')+'"><span class="nav-icon" aria-hidden="true">'+icons[label]+'</span>'+label+'</a>';}
function chrome(content){
 const active=screen==='home'?'Home':'Categories';
 return '<div class="app"><aside class="sidebar"><div class="logo">finance</div><nav>'+nav('Home','home',active==='Home')+nav('Transactions','home',false)+nav('Categories','categories',active==='Categories')+nav('Income sources','categories',false)+nav('Accounts','home',false)+nav('Locations','categories',false)+'</nav><div class="sidebar-footer"><span>◐ &nbsp; '+(document.documentElement.dataset.theme==='dark'?'Dark':'Light')+' theme</span><span>Demo account</span></div></aside><main class="main '+(screen==='form'?'form-main':'')+'">'+content+'</main><nav class="bottom-nav" aria-label="Main navigation">'+nav('Home','home',active==='Home')+nav('Transactions','home',false)+nav('Categories','categories',active==='Categories')+'<button class="primary" data-action="new">＋</button><button class="nav-item" data-action="more"><span class="nav-icon">•••</span>More</button></nav></div>';
}
function row(label,value,cls=''){return '<div class="calc-row '+cls+'"><span>'+label+'</span><strong class="amount">'+value+'</strong></div>';}
function format(value){return new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(value);}
function tx(name,meta,amount,positive=false){return '<div class="tx"><span class="initial">'+name[0]+'</span><div class="meta"><strong>'+name+'</strong><small>'+meta+'</small></div><span class="amount '+(positive?'positive':'')+'">'+amount+'</span></div>';}
function notice(){return state==='unvalued'?'<div class="callout"><strong>Some expenses are not valued yet</strong>Income costs: 100.00 USD. Figures above include valued transactions only. Net income will change when these expenses are valued.</div>':'';}
function skeleton(){return '<div aria-busy="true" aria-label="Loading"><div class="loading"></div><div class="loading wide"></div><div class="loading"></div></div>';}
function failed(subject){return '<div class="error"><h3>Could not load '+subject+'</h3><p>Your entries are safe. Try again.</p><button data-action="retry">Try again</button></div>';}
function summary(){
 if(state==='loading')return '<section class="panel">'+skeleton()+'</section>';
 if(state==='error')return '<section class="panel"><h2>This month</h2>'+failed('the summary')+'</section>';
 const gross=state==='empty'?0:state==='negative'?500:5000;
 const work=state==='empty'?0:1000,personal=state==='empty'?0:1600;
 const net=gross-work,left=net-personal;
 const money=format;
 if(variant==='a')return '<section class="panel"><div class="summary-heading"><h2>This month</h2><small>November 2026</small></div>'+row('Gross income',money(gross))+row('Income costs','−'+money(work))+row('Net income',money(net),'total-row '+(net<0?'negative':'positive'))+row('Personal spending','−'+money(personal))+row('Left',money(left),'left-row '+(left<0?'negative':''))+'<p class="caption">Income costs include fees, work subscriptions and taxes. Based on payment dates.</p>'+notice()+'</section>';
 return '<section class="panel"><div class="section-head"><h2>This month</h2><small>November 2026</small></div><div class="hero-net"><small>Net income</small><p class="amount '+(net<0?'negative':'positive')+'">'+money(net)+'</p><small>After income costs and taxes</small></div><div class="tiles"><div class="tile"><span>Gross income</span><strong class="amount">'+money(gross)+'</strong></div><div class="tile"><span>Income costs</span><strong class="amount">−'+money(work)+'</strong></div></div>'+row('Personal spending','−'+money(personal))+row('Left',money(left),'total-row '+(left<0?'negative':''))+'<p class="caption">Based on payment dates.</p>'+notice()+'</section>';
}
function home(){
 const recent=state==='empty'?'<div class="error"><h3>No transactions yet</h3><p>Add income or spending to see your month.</p><button data-action="new" class="primary">New transaction</button></div>':tx('Client payment','Freelance · Main account','+€5,000.00',true)+'<p class="tx-day">22 November</p>'+tx('Taxes','Main account · Income costs','−€750.00')+tx('Work subscriptions','Main account · Income costs','−€150.00')+tx('Platform fees','Main account · Income costs','−€100.00')+'<p class="tx-day">21 November</p>'+tx('Groceries','Main account · Personal','−€86.40')+tx('Rent','Main account · Personal','−€1,200.00');
 return '<header class="page-head"><div><span class="phone-logo">finance</span><h1 class="desktop-only">Home</h1></div><button class="primary" data-action="new">＋ New</button></header><div class="home-grid"><div class="home-left"><section class="panel"><p class="balance-label">Total balance</p><p class="total amount">'+(state==='empty'?'€0.00':'€12,450.00')+'</p><div class="account-row"><span class="account-mark">M</span><span>Main account</span><span class="amount">'+(state==='empty'?'€0.00':'€10,950.00')+'</span></div><div class="account-row"><span class="account-mark orange">C</span><span>Cash</span><span class="amount">'+(state==='empty'?'€0.00':'€1,500.00')+'</span></div></section>'+summary()+'</div><section class="panel"><div class="section-head"><h2>Recent transactions</h2><small>All transactions</small></div><p class="tx-day">23 November</p>'+recent+'</section></div>';
}
const categories=[
 {name:'Groceries',type:'VARIABLE',purpose:'PERSONAL',desc:'Food and everyday essentials'},
 {name:'Platform fees',type:'VARIABLE',purpose:'INCOME_COST',desc:'Payment processing and platform fees'},
 {name:'Rent',type:'FIXED',purpose:'PERSONAL',desc:'Monthly rent'},
 {name:'Work subscriptions',type:'FIXED',purpose:'INCOME_COST',desc:'Tools and software for work'},
 {name:'Travel',type:'PERIODIC',purpose:'PERSONAL',desc:'Trips and holidays'},
 {name:'Taxes',type:'PERIODIC',purpose:'INCOME_COST',desc:'Taxes on earnings'}
];
function categoryList(){
 let filtered=categories.filter(c=>(purposeFilter==='all'||c.purpose===purposeFilter));
 const search=document.getElementById('category-search')?.value.toLowerCase()||'';
 filtered=filtered.filter(c=>c.name.toLowerCase().includes(search));
 if(state==='empty')return '<div class="error"><h3>No categories yet</h3><p>Add what you spend on, like groceries or work tools.</p><button data-screen="form" class="primary">New category</button></div>';
 if(state==='loading')return skeleton();
 if(state==='error')return failed('categories');
 if(!filtered.length)return '<div class="error"><h3>No matching categories</h3><p>Try another name or purpose.</p><button data-action="clear">Clear filters</button></div>';
 const groups=variant==='a'?['VARIABLE','FIXED','PERIODIC']:['PERSONAL','INCOME_COST'];
 const label={VARIABLE:'Variable',FIXED:'Fixed',PERIODIC:'Periodic',PERSONAL:'Personal',INCOME_COST:'Income costs'};
 return groups.map(group=>{
 const rows=filtered.filter(c=>(variant==='a'?c.type:c.purpose)===group);
 if(!rows.length)return '';
 return '<div class="group-label"><span>'+label[group]+'</span><span>'+rows.length+'</span></div>'+rows.map(c=>'<button class="category '+(c.name==='Work subscriptions'?'selected':'')+'" data-action="edit" aria-label="Edit '+c.name+'"><span class="initial">'+c.name[0]+'</span><span class="category-copy">'+c.name+'<small>'+(variant==='a'?c.desc:label[c.type])+'</small></span>'+(variant==='a'&&c.purpose==='INCOME_COST'?'<span class="badge">Income costs</span>':'')+'<span class="edit" aria-hidden="true">⋯</span></button>').join('');
 }).join('');
}
function categoryScreen(){
 return '<header class="page-head"><div><h1>Categories</h1><small>6 categories</small></div><button class="primary" data-screen="form">＋ New<span class="desktop-only"> category</span></button></header><div class="catalog-layout"><section><input class="search" id="category-search" placeholder="Search categories" aria-label="Search categories"><div class="filters" aria-label="Purpose filter"><button data-filter="all" class="chosen">All purposes</button><button data-filter="PERSONAL">Personal</button><button data-filter="INCOME_COST">Income costs</button></div>'+(variant==='a'?'<div class="filters"><button class="chosen" data-action="type">All types</button><button data-action="type">Variable</button><button data-action="type">Fixed</button><button data-action="type">Periodic</button></div>':'')+'<div id="category-list">'+categoryList()+'</div><p class="catalog-tip">Income costs reduce net income.<br>Personal spending is deducted after net income.</p></section><section class="catalog-detail"><div class="detail-head"><div><h2>Work subscriptions</h2><small>Category · Fixed · Income costs</small></div><button data-screen="form">Edit</button></div><p class="muted">Tools and software for work</p><dl class="detail-info"><div><dt>Purpose</dt><dd>Income costs</dd></div><div><dt>Type</dt><dd>Fixed</dd></div></dl><p class="caption">All expenses in this category reduce net income, including past transactions.</p><p class="tx-day">22 November</p>'+tx('Main account','Software · Monthly renewal','−€150.00')+'<p class="tx-day">22 October</p>'+tx('Main account','Software · Monthly renewal','−€150.00')+'</section></div>';
}
function purposeField(){
 const selected=purpose==='INCOME_COST';
 if(variant==='a')return '<div class="segments"><button type="button" data-purpose="PERSONAL" aria-pressed="'+!selected+'" class="'+(!selected?'chosen':'')+'">Personal</button><button type="button" data-purpose="INCOME_COST" aria-pressed="'+selected+'" class="'+(selected?'chosen':'')+'">Income costs</button></div><p>'+(selected?'Fees, work subscriptions and taxes. These expenses reduce net income.':'Everyday and personal expenses. Deducted after net income.')+'</p>';
 return '<div class="choices"><button type="button" data-purpose="PERSONAL" aria-pressed="'+!selected+'" class="choice '+(!selected?'chosen':'')+'"><span class="radio"></span><span>Personal<small>Everyday spending. Deducted after net income.</small></span></button><button type="button" data-purpose="INCOME_COST" aria-pressed="'+selected+'" class="choice '+(selected?'chosen':'')+'"><span class="radio"></span><span>Income costs<small>Fees, work subscriptions and taxes. Reduce net income.</small></span></button></div>';
}
function formScreen(){
 return '<header class="page-head"><h1>Categories</h1><button data-screen="categories">Back to categories</button></header><div class="form-page"><section class="form-card"><div class="form-head"><h2>Edit category</h2><button class="close" aria-label="Close" data-screen="categories">×</button></div><form id="category-form"><div class="field"><label for="name">Name</label><input id="name" value="Work subscriptions" required minlength="3" maxlength="32"></div><fieldset class="field"><legend>Purpose</legend><div id="purpose-field">'+purposeField()+'</div></fieldset><fieldset class="field"><legend>Type</legend><div class="segments" id="type-field">'+['VARIABLE','FIXED','PERIODIC'].map(type=>'<button type="button" data-type="'+type+'" class="'+(type===categoryType?'chosen':'')+'" aria-pressed="'+(type===categoryType)+'">'+type[0]+type.slice(1).toLowerCase()+'</button>').join('')+'</div><p id="type-hint">The same amount every month, like rent or subscriptions.</p></fieldset><div class="field"><label for="description">Description <span class="muted">· Optional</span></label><textarea id="description" maxlength="256">Tools and software for work</textarea></div><div id="history-note"></div><div class="form-actions"><button type="button" data-screen="categories">Cancel</button><button type="submit" class="primary">Save changes</button></div><p class="caption">Interactive mockup. Changes are not saved to your account.</p></form></section></div>';
}
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.role='status';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),3500);}
document.getElementById('app').innerHTML=chrome(screen==='categories'?categoryScreen():screen==='form'?formScreen():home());
document.addEventListener('click',event=>{
 const navigation=event.target.closest('[data-screen]');
 if(navigation){event.preventDefault();navigate(navigation.dataset.screen);return;}
 const purposeButton=event.target.closest('[data-purpose]');
 if(purposeButton){purpose=purposeButton.dataset.purpose;document.getElementById('purpose-field').innerHTML=purposeField();document.getElementById('history-note').innerHTML=purpose==='PERSONAL'?'<div class="callout"><strong>Applies to all transactions in this category</strong>Past net income will be recalculated. Account balances stay the same.</div>':'';return;}
 const typeButton=event.target.closest('[data-type]');
 if(typeButton){categoryType=typeButton.dataset.type;for(const b of document.querySelectorAll('[data-type]')){b.classList.toggle('chosen',b===typeButton);b.setAttribute('aria-pressed',String(b===typeButton));}document.getElementById('type-hint').textContent={VARIABLE:'Spending that changes from month to month, like groceries or taxis.',FIXED:'The same amount every month, like rent or subscriptions.',PERIODIC:'Comes a few times a year, like insurance or gifts.'}[categoryType];return;}
 const filter=event.target.closest('[data-filter]');
 if(filter){purposeFilter=filter.dataset.filter;for(const b of document.querySelectorAll('[data-filter]'))b.classList.toggle('chosen',b===filter);document.getElementById('category-list').innerHTML=categoryList();return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='edit')navigate('form');
 if(action==='clear'){purposeFilter='all';document.getElementById('category-search').value='';for(const b of document.querySelectorAll('[data-filter]'))b.classList.toggle('chosen',b.dataset.filter==='all');document.getElementById('category-list').innerHTML=categoryList();}
 if(action==='retry')toast('Retry shown in mockup. Use “Обычное” in the preview toolbar.');
 if(action==='new')toast('Income and expenses remain separate transactions. This form is outside the design change.');
 if(action==='more')toast('Accounts · Income sources · Locations');
 if(action==='type')toast('Existing type filter is preserved. Try the new purpose filter above.');
});
document.getElementById('category-search')?.addEventListener('input',()=>{document.getElementById('category-list').innerHTML=categoryList();});
document.getElementById('category-form')?.addEventListener('submit',event=>{event.preventDefault();toast('Preview only · Category saved');});
