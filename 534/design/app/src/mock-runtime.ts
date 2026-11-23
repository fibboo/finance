export const preview = new URLSearchParams(location.search);
export const isBaseline = preview.get('compare') === 'before';
const state = preview.get('state') ?? 'normal';
const theme = preview.get('theme') === 'light' ? 'light' : 'dark';
localStorage.setItem('theme', theme);
localStorage.setItem('menu', 'full');
document.documentElement.dataset.theme = theme;
if (!location.hash) location.hash = preview.get('screen') === 'home' ? '#/' : '#/categories';
const uid = '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11';
function id(index:number){return '10000000-0000-4000-8000-'+String(index).padStart(12,'0');}
function account(index:number,name:string,kind:string,extra:Record<string,unknown>={}){
 return {id:id(index),user_id:uid,name,description:null,kind,currency:null,color:null,category_type:null,category_purpose:null,balance:'0',base_currency_balance:'0.00',base_currency_rate:'1',estimated_base_balance:null,status:'ACTIVE',...extra};
}
const empty=state==='empty';
const main=account(1,'Main account','ASSET',{currency:'EUR',color:'#527EC1',balance:empty?'0':'10950',base_currency_balance:empty?'0.00':'10950.00'});
const cash=account(2,'Cash','ASSET',{currency:'EUR',color:'#C88443',balance:empty?'0':'1500',base_currency_balance:empty?'0.00':'1500.00'});
const income=account(3,'Freelance','INCOME');
export const categories=[
 account(11,'Groceries','EXPENSE',{category_type:'VARIABLE',category_purpose:'PERSONAL',description:'Supermarkets and markets'}),
 account(12,'Platform fees','EXPENSE',{category_type:'VARIABLE',category_purpose:'INCOME_COST',description:'Payment processing'}),
 account(13,'Rent','EXPENSE',{category_type:'FIXED',category_purpose:'PERSONAL',description:'Monthly rent'}),
 account(14,'Work subscriptions','EXPENSE',{category_type:'FIXED',category_purpose:'INCOME_COST',description:'Tools and software'}),
 account(15,'Travel','EXPENSE',{category_type:'PERIODIC',category_purpose:'PERSONAL',description:'Trips and holidays'}),
 account(16,'Taxes','EXPENSE',{category_type:'PERIODIC',category_purpose:'INCOME_COST',description:'Taxes on earnings'})
];
const locationEntry={id:id(70),user_id:uid,name:'Online',description:null,status:'ACTIVE'};
const gross=empty?0:state==='negative'?500:5000;
const costs=empty?0:1000;
const personal=empty?0:1600;
const transactions=[
 {index:31,date:'2026-11-23',amount:gross,kind:'INCOME',from:income,to:main,comment:'Client payment'},
 {index:32,date:'2026-11-22',amount:750,kind:'EXPENSE',from:main,to:categories[5],comment:'Quarterly tax payment'},
 {index:33,date:'2026-11-22',amount:150,kind:'EXPENSE',from:main,to:categories[3],comment:'Monthly subscriptions'},
 {index:34,date:'2026-11-22',amount:100,kind:'EXPENSE',from:main,to:categories[1],comment:'Platform commission'},
 {index:35,date:'2026-11-21',amount:86.4,kind:'EXPENSE',from:main,to:categories[0],comment:null},
 {index:36,date:'2026-11-01',amount:1200,kind:'EXPENSE',from:main,to:categories[2],comment:null},
 {index:37,date:'2026-11-01',amount:313.6,kind:'EXPENSE',from:cash,to:categories[4],comment:'Train tickets'}
].map(row=>({
 id:id(row.index),user_id:uid,transaction_date:row.date,comment:row.comment,
 base_currency_amount:row.amount.toFixed(2),income_period:row.kind==='INCOME'?'2026-11-01':null,
 transaction_type:row.kind,status:'ACTIVE',created_at:row.date+'T10:00:00Z',updated_at:row.date+'T10:00:00Z',
 location:row.kind==='EXPENSE'?locationEntry:null,estimated_base_currency_amount:null,
 postings:[{id:id(row.index+100),amount:(-row.amount).toFixed(2),currency:'EUR',base_amount:(-row.amount).toFixed(2),estimated_base_amount:null,account:row.from},{id:id(row.index+200),amount:row.amount.toFixed(2),currency:'EUR',base_amount:row.amount.toFixed(2),estimated_base_amount:null,account:row.to}]
}));
const allAccounts=[main,cash,income,...categories];
const originalFetch=window.fetch.bind(window);
function page(items:unknown[],url:URL){const size=Number(url.searchParams.get('size')??100),current=Number(url.searchParams.get('page')??1);return {items:items.slice((current-1)*size,current*size),total:items.length,page:current,size,pages:Math.max(1,Math.ceil(items.length/size))};}
const dictionaries={
 currencies:[{key:'EUR',label:'Euro'},{key:'USD',label:'US Dollar'}],
 account_kinds:['ASSET','LIABILITY','INCOME','EXPENSE'].map(key=>({key,label:key[0]+key.slice(1).toLowerCase()})),
 category_types:[{key:'VARIABLE',label:'Variable'},{key:'FIXED',label:'Fixed'},{key:'PERIODIC',label:'Periodic'}],
 category_purposes:[{key:'PERSONAL',label:'Personal'},{key:'INCOME_COST',label:'Income costs'}],
 transaction_types:[{key:'INCOME',label:'Income'},{key:'EXPENSE',label:'Expense'},{key:'TRANSFER',label:'Transfer'},{key:'ADJUSTMENT',label:'Adjustment'}],
 transaction_orders:[{key:'-transaction_date',label:'Newest first'}]
};
window.fetch=async (input,init)=>{
 const request=input instanceof Request?input:new Request(input,init);
 const url=new URL(request.url,location.origin);
 if(!url.pathname.startsWith('/api/'))return originalFetch(input,init);
 const route=url.pathname.slice(4);
 const respond=(body:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
 if(route==='/user/auth/token')return respond({access_token:'mockup-preview-only',token_type:'bearer'});
 if(route==='/user/me')return respond({id:uid,username:'nikita',avatar:null,registration_provider:'GOOGLE',base_currency:'EUR',external_users:[]});
 if(route==='/dictionaries/accounting')return respond(dictionaries);
 if(route==='/dictionaries/user')return respond({provider_types:[{key:'GOOGLE',label:'Google'},{key:'TELEGRAM',label:'Telegram'}]});
 if(route==='/accounting/currencies')return respond(dictionaries.currencies);
 if(route==='/accounting/summary'){
  if(state==='loading')return new Promise(()=>{});
  if(state==='error')return respond({message:'Preview: summary unavailable',error_code:'PREVIEW_ERROR'},503);
  return respond({month:'2026-11-01',total_balance:empty?'0.00':'12450.00',estimated_total_balance:null,
   earned:gross.toFixed(2),spent:(costs+personal).toFixed(2),left_over:(gross-costs-personal).toFixed(2),
   income_costs:costs.toFixed(2),net_income:(gross-costs).toFixed(2),personal_spending:personal.toFixed(2),
   unvalued_spent:state==='unvalued'?[{currency:'USD',amount:'100.00'}]:[],estimated_unvalued_spent:null,estimate_rates:[]});
 }
 if(route==='/accounting/accounts'){
  const kinds=url.searchParams.getAll('kinds'),types=url.searchParams.getAll('category_types'),search=(url.searchParams.get('search_term')??'').toLowerCase();
  const accounts=allAccounts.filter(a=>(!kinds.length||kinds.includes(a.kind))&&(!types.length||types.includes(a.category_type as string))&&(!search||a.name.toLowerCase().includes(search)));
  return respond(page(empty?accounts.filter(a=>a.kind==='ASSET'):accounts,url));
 }
 if(route.startsWith('/accounting/accounts/')){
  const found=allAccounts.find(a=>a.id===route.split('/')[3]);
  if(request.method==='PUT'&&found){Object.assign(found,await request.json());return respond(found);}
  return found?respond(found):respond({error_code:'ENTITY_NOT_FOUND',message:'Not found'},404);
 }
 if(route==='/accounting/transactions'){
  const accounts=url.searchParams.getAll('account_ids');
  const types=url.searchParams.getAll('transaction_types');
  const items=empty?[]:transactions.filter(t=>(!accounts.length||t.postings.some(p=>accounts.includes(p.account.id)))&&(!types.length||types.includes(t.transaction_type)));
  return respond(page(items,url));
 }
 if(route.startsWith('/accounting/transactions/'))return respond(transactions.find(t=>t.id===route.split('/')[3])??transactions[0]);
 if(route==='/accounting/locations')return respond(page([locationEntry],url));
 return respond({message:'Not available in this mockup',error_code:'PREVIEW_ONLY'},404);
};
if(preview.get('screen')==='form'){
 const observer=new MutationObserver(()=>{
  const row=[...document.querySelectorAll('li')].find(el=>el.textContent?.includes('Work subscriptions'));
  const button=row?.querySelector<HTMLButtonElement>('button[aria-label="Edit"]');
  if(button){observer.disconnect();button.click();}
 });
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
