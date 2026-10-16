import type { LiveState } from '@/lib/live';

export type PresentView = 'code' | 'question' | 'report';

export interface PresentMessage {
  view: PresentView;
  state?: LiveState;
}

export function isPresentView(view: unknown): view is PresentView {
  return view === 'code' || view === 'question' || view === 'report';
}

export function readPresentView(sessionId: string): PresentView | null {
  const view = localStorage.getItem(presentChannelName(sessionId));
  return isPresentView(view) ? view : null;
}

export function postPresentView(
  sessionId: string,
  view: PresentView,
  state?: LiveState,
): void {
  localStorage.setItem(presentChannelName(sessionId), view);
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(presentChannelName(sessionId));
  channel.postMessage({ view, ...(state ? { state } : {}) } satisfies PresentMessage);
  channel.close();
}

export function presentChannelName(sessionId: string): string {
  return `liveq.present.${sessionId}`;
}
