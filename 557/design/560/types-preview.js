const previewParams = new URLSearchParams(location.search);
const catalog = previewParams.get('screen') === 'categories' ? 'category' : 'account';
const variant = previewParams.get('variant') ?? '1';
const flow = previewParams.get('flow') ?? 'manage';
const single = previewParams.get('types') === 'single';
const originalTypes = catalog === 'account' ? ['Asset', 'Liability'] : ['Variable', 'Fixed', 'Periodic'];
const records = catalog === 'account' ? ['Main account', 'Travel card'] : ['Groceries', 'Rent', 'Insurance'];
const descriptions = catalog === 'account' ? 'Everyday banking' : 'Supermarkets and markets';
const dialog = document.createElement('dialog');
dialog.className = 'preview-panel';
dialog.setAttribute('aria-labelledby', 'types-heading');
let types = originalTypes.slice(0, single ? 1 : undefined).map((name, index) => ({
  name, isDefault: index === 0, record: records[index]
}));

function escapeText(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function openPanel(title, content) {
  dialog.innerHTML = '<header><h2 id="types-heading">' + title + '</h2><button type="button" data-action="close" aria-label="Close">×</button></header>' + content;
  if (!dialog.open) dialog.showModal();
}

const EDIT_ICON_PATH = 'M4 20h4L19 9l-4-4L4 16z';
const CHECK_ICON_PATH = 'm5 12 5 5 9-10';
const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';
const DELETE_ICON_PATH = 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';

function typeActions(index) {
  const edit = typeAction({ index, action: 'rename', label: 'Edit', iconPath: EDIT_ICON_PATH });
  const remove = types.length > 1
    ? typeAction({ index, action: 'remove', label: 'Delete', iconPath: DELETE_ICON_PATH })
    : '';
  return '<span class="preview-row-actions">' + edit + remove + '</span>';
}

function typeAction({ index, action, label, iconPath }) {
  return '<button type="' + (action === 'save' ? 'submit' : 'button') + '" class="preview-row-action' + (action === 'remove' ? ' danger' : '') +
    '" data-action="' + action + '" data-index="' + index + '" aria-label="' + label + '" title="' + label +
    '"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + iconPath + '"></path></svg></button>';
}

function showSettings({ editingIndex, focusIndex } = {}) {
  const rows = types.map((type, index) => {
    const defaultLabel = type.isDefault ? '<small>Default</small>' : '';
    if (index !== editingIndex) {
      return '<li class="preview-type"><span>' + escapeText(type.name) + defaultLabel + '</span>' + typeActions(index) + '</li>';
    }

    const save = typeAction({ index, action: 'save', label: 'Save name', iconPath: CHECK_ICON_PATH });
    const cancel = typeAction({ index, action: 'cancel-rename', label: 'Cancel editing', iconPath: CLOSE_ICON_PATH });
    return '<li class="preview-type"><form class="preview-rename" data-action="rename" data-index="' + index +
      '"><div><input name="name" aria-label="Type name" required maxlength="100" value="' + escapeText(type.name) +
      '">' + defaultLabel + '</div><span class="preview-row-actions">' + save + cancel + '</span></form></li>';
  });
  openPanel(catalog === 'account' ? 'Account types' : 'Category types',
    '<ul class="preview-type-list" style="list-style:none;padding:0;margin:0">' + rows.join('') +
    '</ul><footer><button class="primary" type="button" data-action="add">New type</button></footer>');
  if (editingIndex !== undefined) {
    const name = dialog.querySelector('.preview-rename input');
    name.focus();
    name.select();
  }
  if (focusIndex !== undefined) {
    dialog.querySelector('[data-action="rename"][data-index="' + focusIndex + '"]').focus();
  }
}

function showTypeForm(action, index) {
  const type = types[index];
  const isRemove = action === 'remove';
  const needsReplacement = isRemove && (type.record || type.isDefault);
  const replacementOptions = isRemove ? types.map((option, otherIndex) => otherIndex === index
    ? '' : '<option value="' + otherIndex + '">' + escapeText(option.name) + '</option>').join('') : '';
  const fields = isRemove
    ? '<p>Remove “' + escapeText(type.name) + '”?</p>' + (needsReplacement
      ? '<label>' + (type.record ? 'Move ' + catalog + 's to' : 'New default type') +
        '<select name="replacement" required><option value="">Choose a type</option>' + replacementOptions +
        '</select></label>' + (type.isDefault && type.record ? '<small>The replacement will become the default type.</small>' : '')
      : '')
    : '<label>Name <input name="name" required maxlength="100" value="' + escapeText(type?.name ?? '') + '"></label>';
  const title = isRemove ? 'Remove type' : 'New type';
  const button = isRemove ? 'Remove type' : 'Create type';
  openPanel(title, '<form data-action="' + action + '" data-index="' + index + '">' + fields +
    '<footer><button type="button" data-action="settings">Cancel</button><button class="' +
    (isRemove ? 'danger' : 'primary') + '">' + button + '</button></footer></form>');
}

function showEntityForm(mode) {
  const editing = mode === 'edit';
  const typesField = types.length > 1 ? '<label>Type<select name="type">' +
    types.map(type => '<option' + (type.isDefault ? ' selected' : '') + '>' + escapeText(type.name) + '</option>').join('') +
    '</select></label>' : '';
  const groupField = variant === '2' && typesField ? '<fieldset><legend>Classification</legend>' + typesField + '</fieldset>' : typesField;
  const purpose = '<fieldset><legend>Purpose</legend><div class="preview-radio-group"><label><input type="radio" name="purpose" checked>Personal</label><label><input type="radio" name="purpose">Income costs</label></div><small id="purpose-hint">Everyday spending. Deducted after net income.</small></fieldset>';
  const currency = editing ? '<div>Currency <strong>EUR</strong><small> · Currency is fixed after creation.</small></div>'
    : '<label>Currency<select name="currency"><option>EUR · Euro</option><option>USD · US Dollar</option></select></label>';
  openPanel((editing ? 'Edit ' : 'New ') + catalog, '<form data-action="entity">' +
    '<label>Name<input name="name" required value="' + (editing ? records[0] : '') + '"></label>' +
    (catalog === 'account' ? groupField + currency + '<label>Color<input type="color" value="#1f7a55"></label>' : purpose + groupField) +
    '<label>Description <small>Optional</small><textarea name="description">' + (editing ? descriptions : '') + '</textarea></label>' +
    '<footer><button type="button" data-action="close">Cancel</button><button class="primary">' +
    (editing ? 'Save changes' : 'Create ' + catalog) + '</button></footer></form>');
}

dialog.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, index } = button.dataset;
  if (action === 'close') dialog.close();
  else if (action === 'settings') showSettings();
  else if (action === 'rename') showSettings({ editingIndex: Number(index) });
  else if (action === 'cancel-rename') showSettings({ focusIndex: Number(index) });
  else if (action !== 'save') showTypeForm(action, index === undefined ? -1 : Number(index));
});
dialog.addEventListener('keydown', event => {
  const form = event.target.closest('.preview-rename');
  if (event.key === 'Escape' && form) {
    event.preventDefault();
    showSettings({ focusIndex: Number(form.dataset.index) });
  }
});
dialog.addEventListener('change', event => {
  const hint = dialog.querySelector('#purpose-hint');
  if (event.target.name === 'purpose' && hint) {
    hint.textContent = event.target.parentElement.textContent.trim() === 'Personal'
      ? 'Everyday spending. Deducted after net income.'
      : 'Fees, work subscriptions and taxes. Reduce net income.';
  }
});
dialog.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const { action, index } = form.dataset;
  if (action === 'entity') {
    dialog.close();
    return;
  }
  if (action === 'remove') {
    const replacement = values.get('replacement');
    if (replacement !== null) {
      const replacementType = types[Number(replacement)];
      replacementType.record ||= types[index].record;
      replacementType.isDefault ||= types[index].isDefault;
    }
    types = types.filter((type, typeIndex) => typeIndex !== Number(index));
  } else {
    const name = values.get('name').trim();
    const duplicate = types.some((type, typeIndex) => typeIndex !== Number(index) && type.name.toLowerCase() === name.toLowerCase());
    if (!name || duplicate) {
      const field = form.elements.namedItem('name');
      field.setCustomValidity(duplicate ? 'A type with this name already exists.' : 'Enter a type name.');
      field.reportValidity();
      field.addEventListener('input', () => field.setCustomValidity(''), { once: true });
      return;
    }
    if (action === 'add') types = [...types, { name, isDefault: false }];
    else types[index].name = name;
  }
  showSettings(action === 'rename' ? { focusIndex: Number(index) } : undefined);
});

const observer = new MutationObserver(() => {
  const main = document.querySelector('main');
  const newButton = [...(main?.querySelectorAll('button') ?? [])].find(button => /^New\s+(account|category)$/i.test(button.textContent.trim()));
  if (!newButton) return;
  observer.disconnect();
  if (variant === '0') {
    if (flow === 'create') newButton.click();
    if (flow === 'edit') main.querySelector('button[aria-label="Edit"]')?.click();
    return;
  }
  document.body.append(dialog);
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'preview-entry';
  manage.textContent = 'Manage types';
  manage.addEventListener('click', () => showSettings());
  newButton.after(manage);
  newButton.addEventListener('click', event => {
    event.stopPropagation();
    showEntityForm('create');
  });
  if (flow === 'manage') showSettings();
  else showEntityForm(flow);
});
observer.observe(document.body, { childList: true, subtree: true });
