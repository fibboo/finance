const DATA_CHANGE_CHANNEL_NAME = 'finance-data-change';

const dataChangeChannel = new BroadcastChannel(DATA_CHANGE_CHANNEL_NAME);

export function announceDataChange(): void {
  dataChangeChannel.postMessage(null);
}

export function subscribeToDataChanges(listener: () => void): () => void {
  const handleMessage = (): void => {
    listener();
  };
  dataChangeChannel.addEventListener('message', handleMessage);

  return () => {
    dataChangeChannel.removeEventListener('message', handleMessage);
  };
}
