import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { announceDataChange, subscribeToDataChanges } from '@/app/data-change-channel';

let otherTab = new BroadcastChannel('finance-data-change');

beforeEach(() => {
  otherTab = new BroadcastChannel('finance-data-change');
});

afterEach(() => {
  otherTab.close();
});

test('tells another tab that the data changed', async () => {
  // arrange
  const receivedMessages: unknown[] = [];
  otherTab.addEventListener('message', (event) => {
    receivedMessages.push(event.data);
  });

  // act
  announceDataChange();

  // assert
  await expect.poll(() => receivedMessages).toHaveLength(1);
});

test('calls the subscribers when another tab announces a change, but not the unsubscribed ones', async () => {
  // arrange
  const subscribedListener = vi.fn();
  const unsubscribedListener = vi.fn();
  const unsubscribe = subscribeToDataChanges(unsubscribedListener);
  const unsubscribeSubscribed = subscribeToDataChanges(subscribedListener);
  unsubscribe();

  // act
  otherTab.postMessage(null);

  // assert
  await expect.poll(() => subscribedListener).toHaveBeenCalledOnce();
  expect(unsubscribedListener).not.toHaveBeenCalled();
  unsubscribeSubscribed();
});
