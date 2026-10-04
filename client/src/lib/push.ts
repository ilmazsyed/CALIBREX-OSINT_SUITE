/** Web Push (PWA notifications) client helpers. */
import { api } from './api';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const r = await navigator.serviceWorker.getRegistration();
  return r || navigator.serviceWorker.register('/sw.js');
}

export async function pushState(): Promise<{ supported: boolean; permission: NotificationPermission; subscribed: boolean }> {
  if (!pushSupported()) return { supported: false, permission: 'denied', subscribed: false };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.getRegistration(); subscribed = !!(reg && (await reg.pushManager.getSubscription())); } catch { /* ignore */ }
  return { supported: true, permission: Notification.permission, subscribed };
}

/** Request permission and subscribe this device. Throws with a readable message. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Enable them for this site in your browser settings.' : 'Notification permission was not granted.');
  const { key } = await api<{ key: string | null }>('/push/key');
  if (!key) throw new Error('Push is not configured on the server yet.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { try { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); } catch { /* ignore */ } await sub.unsubscribe().catch(() => {}); }
}

export const testPush = () => api<{ ok: boolean; devices: number }>('/push/test', { method: 'POST' });
