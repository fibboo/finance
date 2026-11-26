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
    expect(
      await dialog.findByText(`This type is in use. Choose where to move its ${entities}.`),
    ).toBeInTheDocument();
    const remove = dialog.getByRole('button', { name: 'Remove type' });
    expect(remove).toBeDisabled();
    await user.selectOptions(
      dialog.getByRole('combobox', { name: `Move ${entities} to` }),
      defaultType.id,
    );
    await user.click(remove);

    // assert
    expect(await dialog.findByRole('button', { name: 'Edit Standard' })).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Delete Standard' })).not.toBeInTheDocument();
    expect(dialog.queryByText('Travel expenses')).not.toBeInTheDocument();
    expect(renameBody).toEqual({ name: 'Travel expenses' });
    expect(requestedReplacements).toEqual([null, defaultType.id]);
  },
);
