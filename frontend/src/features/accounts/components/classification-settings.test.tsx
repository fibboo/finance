import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { ClassificationSettings } from './classification-settings';

test.each([
  { kind: 'MONEY_ACCOUNT', title: 'Account types', entities: 'accounts' },
  { kind: 'EXPENSE_CATEGORY', title: 'Category types', entities: 'categories' },
] as const)(
  'creates, renames in place and reassigns a removed type in $title',
  async ({ kind, title, entities }) => {
    // arrange
    const defaultType = {
      id: '10000000-0000-4000-8000-000000000031',
      name: 'Standard',
      is_default: true,
      kind,
    };
    const customType = {
      id: '10000000-0000-4000-8000-000000000032',
      name: 'Travel',
      is_default: false,
      kind,
    };
    const path = `http://localhost/api/accounting/classifications/${kind}`;
    let types: components['schemas']['Classification'][] = [defaultType];
    let renameBody: unknown;
    const requestedReplacements: (string | null)[] = [];
    server.use(
      http.get(path, () => HttpResponse.json(types)),
      http.post(path, () => {
        types = [defaultType, customType];
        return HttpResponse.json(customType, { status: 201 });
      }),
      http.put(`${path}/${customType.id}`, async ({ request }) => {
        renameBody = await request.json();
        const renamedType = { ...customType, name: 'Travel expenses' };
        types = [defaultType, renamedType];
        return HttpResponse.json(renamedType);
      }),
      http.delete(`${path}/${customType.id}`, ({ request }) => {
        const replacementId = new URL(request.url).searchParams.get('replacement_id');
        requestedReplacements.push(replacementId);
        if (replacementId === null) {
          return HttpResponse.json(
            { error_code: 'CLASSIFICATION_REPLACEMENT_REQUIRED', message: 'Choose a replacement' },
            { status: 409 },
          );
        }

        types = [defaultType];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<ClassificationSettings kind={kind} />);
    await user.click(screen.getByRole('button', { name: 'Manage types' }));
    const dialog = within(screen.getByRole('dialog', { name: title }));
    await user.click(await dialog.findByRole('button', { name: 'New type' }));
    await user.type(dialog.getByRole('textbox', { name: 'Name' }), 'Travel');
    await user.click(dialog.getByRole('button', { name: 'Create type' }));
    const edit = await dialog.findByRole('button', { name: 'Edit Travel' });
    await user.click(edit);
    const name = dialog.getByRole('textbox', { name: 'Type name' });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, 'Discard{Escape}');
    expect(edit).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Edit Travel' })).toHaveFocus();
    expect(renameBody).toBeUndefined();

    // act
    await user.click(dialog.getByRole('button', { name: 'Edit Travel' }));
    await user.clear(dialog.getByRole('textbox', { name: 'Type name' }));
    await user.type(dialog.getByRole('textbox', { name: 'Type name' }), 'Travel expenses{Enter}');
    await user.click(await dialog.findByRole('button', { name: 'Delete Travel expenses' }));
    await user.click(dialog.getByRole('button', { name: 'Remove type' }));
    const replacementMessage = `This type is in use. Choose where to move its ${entities}.`;
    expect(await dialog.findByRole('alert')).toHaveTextContent(replacementMessage);
    const remove = dialog.getByRole('button', { name: 'Remove type' });
    const replacement = dialog.getByRole('combobox', { name: `Move ${entities} to` });
    expect(replacement).toHaveAccessibleDescription(replacementMessage);
    expect(remove).toBeDisabled();
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    await user.selectOptions(replacement, defaultType.id);
    await user.click(remove);

    // assert
    expect(await dialog.findByRole('button', { name: 'Edit Standard' })).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Delete Standard' })).not.toBeInTheDocument();
    expect(dialog.queryByText('Travel expenses')).not.toBeInTheDocument();
    expect(renameBody).toEqual({ name: 'Travel expenses' });
    expect(requestedReplacements).toEqual([null, defaultType.id]);
  },
);

test.each([
  { open: 'New type', submit: 'Create type', field: 'Name' },
  { open: 'Edit Travel', submit: 'Save name', field: 'Type name' },
])('shows a duplicate name only at the field when using $open', async ({ open, submit, field }) => {
  // arrange
  const kind = 'MONEY_ACCOUNT';
  const existing = {
    id: '10000000-0000-4000-8000-000000000031',
    name: 'Standard',
    kind,
    is_default: true,
  };
  const custom = {
    id: '10000000-0000-4000-8000-000000000032',
    name: 'Travel',
    kind,
    is_default: false,
  };
  const path = `http://localhost/api/accounting/classifications/${kind}`;
  const message = 'A type with this name already exists';
  const conflict = {
    error_code: 'NAME_ALREADY_EXISTS',
    message,
  } satisfies components['schemas']['ErrorResponse'];
  server.use(
    http.get(path, () => HttpResponse.json([existing, custom])),
    http.post(path, () => HttpResponse.json(conflict, { status: 409 })),
    http.put(`${path}/${custom.id}`, () => HttpResponse.json(conflict, { status: 409 })),
  );
  const user = userEvent.setup();
  render(<ClassificationSettings kind={kind} />);
  await user.click(screen.getByRole('button', { name: 'Manage types' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Account types' }));
  await user.click(await dialog.findByRole('button', { name: open }));
  const name = dialog.getByRole('textbox', { name: field });
  await user.clear(name);
  await user.type(name, existing.name);

  // act
  await user.click(dialog.getByRole('button', { name: submit }));

  // assert
  expect(await dialog.findByRole('alert')).toHaveTextContent(message);
  expect(name).toHaveAccessibleDescription(message);
  expect(name).toHaveValue(existing.name);
  expect(name).toHaveFocus();
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});
