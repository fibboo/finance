const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') || 'dark';
if (params.get('variant') === 'b') document.body.classList.add('compact');
const keys = params.get('variant') === 'b' ? ['7','8','9','⌫','C','4','5','6','×','÷','1','2','3','+','−','(','0','.',')','±'] : ['C','(',')','⌫','7','8','9','÷','4','5','6','×','1','2','3','−','±','0','.','+'];
for (const key of keys) {
 const button = document.createElement('button'); button.textContent = key; button.type = 'button';
 button.className = ['+','−','×','÷'].includes(key) ? 'operator' : ['C','⌫','(',')','±'].includes(key) ? 'utility' : '';
 button.setAttribute('aria-label', key === '⌫' ? 'Delete last character' : key === 'C' ? 'Clear calculation' : key === '±' ? 'Change sign' : key);
 document.getElementById('keys').append(button);
}
if (params.get('context') === 'filter') {
 document.body.classList.add('filterContext'); document.querySelector('.formTitle h2').textContent = 'Amount filter';
 document.querySelector('.form').insertAdjacentHTML('beforeend','<div class="filterRows"><div class="filterRow"><label>From, USD</label><div class="filterControl">42.80 <button aria-label="Calculate lower bound">▦</button></div></div><div class="filterRow"><label>To, USD</label><div class="filterControl">Any <button aria-label="Calculate upper bound">▦</button></div></div></div><p class="muted" style="font-size:12px;margin-top:14px">Compared in your main currency, USD.</p>');
 document.getElementById('targetLabel').textContent = 'Lower bound · USD';
}
if (params.get('state') === 'error') {
 document.getElementById('expression').value = '42.80 ÷ 0'; document.getElementById('result').textContent = '—'; document.getElementById('error').hidden = false;
 document.querySelector('.apply').textContent = 'Apply'; document.querySelector('.apply').disabled = true;
}

if (params.get('grouping') === 'on') { document.getElementById('expression').value = '(12,345.67 + 8,900.50) − 245.17'; document.getElementById('result').innerHTML = '21,001.00 <small>USD</small>'; document.querySelector('.apply').textContent = 'Apply 21,001.00'; }

const calculationInput = document.getElementById('expression'); calculationInput.inputMode = 'none'; calculationInput.addEventListener('beforeinput', event => { if (event.data !== null && !/^[0-9.,+*\x2f()×÷−\s-]*$/u.test(event.data)) event.preventDefault(); });
