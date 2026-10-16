export type PresentView = 'code' | 'question' | 'report';

export function postPresentView(sessionId: string, view: PresentView): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(presentChannelName(sessionId));
  channel.postMessage({ view });
  channel.close();
}

export function presentChannelName(sessionId: string): string {
  return `liveq.present.${sessionId}`;
}
