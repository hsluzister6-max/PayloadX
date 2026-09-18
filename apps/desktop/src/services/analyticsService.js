import api from '@/lib/api';

const SESSION_KEY = 'payloadx_analytics_session';
const FLUSH_MS = 4000;
const MAX_QUEUE = 40;

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `px_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `px_${Date.now().toString(36)}`;
  }
}

let queue = [];
let timer = null;
let lastSectionView = null;

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, MAX_QUEUE);
  try {
    await api.post(
      '/api/analytics/events',
      { events: batch },
      { headers: { 'X-Skip-Auth-Redirect': '1' } },
    );
  } catch {
    // Soft-fail — analytics must never break the app
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_MS);
}

/**
 * Track a product analytics event (batched).
 * @param {{ section: string, eventType: string, target?: string, metadata?: object }} evt
 */
export function trackEvent(evt) {
  if (!evt?.section || !evt?.eventType) return;
  queue.push({
    section: String(evt.section).slice(0, 64),
    eventType: evt.eventType,
    target: evt.target || '',
    metadata: evt.metadata || {},
    sessionId: getSessionId(),
    client: 'desktop',
  });
  if (queue.length >= MAX_QUEUE) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    flush();
  } else {
    scheduleFlush();
  }
}

/** Record a section view once per navigation (deduped). */
export function trackSectionView(section) {
  if (!section || section === lastSectionView) return;
  lastSectionView = section;
  trackEvent({ section, eventType: 'view', target: 'section' });
  trackEvent({ section, eventType: 'nav', target: 'sidebar' });
}

export function trackClick(section, target, metadata) {
  trackEvent({
    section,
    eventType: 'click',
    target: target || '',
    metadata,
  });
}

export function trackCta(section, target, metadata) {
  trackEvent({
    section,
    eventType: 'cta_click',
    target: target || '',
    metadata,
  });
}

/** Flush pending events (call on logout / unload). */
export function flushAnalytics() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  return flush();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushAnalytics();
  });
}
