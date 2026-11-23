const params=new URLSearchParams(location.search);
const controls=['screen','compare','theme','width','state'];
for(const name of controls){
 const control=document.getElementById(name),saved=params.get(name);
 if(saved&&Array.from(control.options).some(option=>option.value===saved))control.value=saved;
 control.addEventListener('change',update);
}
function update(){
 const next=new URLSearchParams();
 for(const name of controls)next.set(name,document.getElementById(name).value);
 history.replaceState(null,'','?'+next);
 document.documentElement.dataset.theme=next.get('theme');
 const frame=document.getElementById('preview');
 frame.className=next.get('width')==='phone'?'phone':'';
 frame.src='app.html?'+next;
 const notes={
 home:'Сохранён текущий layout: карточки счетов, месячная сводка с линией прогресса, список транзакций и колонка деталей на компьютере. Линия показывает долю ВСЕХ расходов от gross, отметка дня сохранена. Добавлены Income costs, Net income и Personal spending; Earned подписан Gross.',
 categories:'Сохранены текущая группировка Variable / Fixed / Periodic, фильтр типа, Deleted, поиск, действия строк и соседняя колонка транзакций. Добавлены фильтр назначения и метка Income costs.',
 form:'Настоящая текущая форма в Sheet: на телефоне снизу, на компьютере по центру. Сохранены поля, кнопка Back и полная ширина Save changes. Добавлено только поле Purpose и предупреждение при смене назначения.'
 };
 document.getElementById('design-note').textContent=notes[next.get('screen')]+' В «Сравнение» можно переключиться на текущий интерфейс на тех же тестовых данных. Операции не затрагивают ваш аккаунт.';
}
update();
