import type { PwaUpdaterApi, UpdateSnapshot, UpdateStatus } from './update-types';

const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INSTALL_WAIT_MS = 15 * 1000;
const SKIP_WAITING_MESSAGE = 'DY_BOARD_SKIP_WAITING';

export function installPwaUpdateBridge(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  let registration: ServiceWorkerRegistration | null = null;
  let waitingWorker: ServiceWorker | null = null;
  let hadController = Boolean(navigator.serviceWorker.controller);
  let snapshot: UpdateSnapshot = { source: 'pwa', status: 'idle' };
  const listeners = new Set<(state: UpdateSnapshot) => void>();
  const watchedWorkers = new WeakSet<ServiceWorker>();

  const publish = (
    status: UpdateStatus,
    details: Omit<Partial<UpdateSnapshot>, 'source' | 'status'> = {},
  ): UpdateSnapshot => {
    snapshot = { source: 'pwa', status, ...details };
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const observeWorker = (worker: ServiceWorker): void => {
    if (watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);

    const inspect = (): void => {
      if (worker.state !== 'installed') return;
      if (navigator.serviceWorker.controller) {
        waitingWorker = registration?.waiting ?? worker;
        publish('available', { action: 'refresh' });
      } else {
        worker.postMessage({ type: SKIP_WAITING_MESSAGE });
      }
    };

    worker.addEventListener('statechange', inspect);
    inspect();
  };

  const waitForInstall = (worker: ServiceWorker): Promise<void> => {
    if (worker.state === 'installed' || worker.state === 'redundant') return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        worker.removeEventListener('statechange', onStateChange);
        resolve();
      };
      const onStateChange = (): void => {
        if (worker.state === 'installed' || worker.state === 'redundant') finish();
      };
      const timeout = window.setTimeout(finish, INSTALL_WAIT_MS);
      worker.addEventListener('statechange', onStateChange);
      onStateChange();
    });
  };

  const runCheck = async (announceResult: boolean): Promise<UpdateSnapshot> => {
    if (!registration) {
      return announceResult
        ? publish('error', { message: '更新服务尚未准备好，请稍后重试。' })
        : snapshot;
    }

    if (announceResult) publish('checking');
    try {
      await registration.update();
      const installing = registration.installing;
      if (installing) {
        observeWorker(installing);
        await waitForInstall(installing);
      }
      if (registration.waiting) {
        waitingWorker = registration.waiting;
        return publish('available', { action: 'refresh' });
      }
      if (registration.installing) return snapshot;
      return announceResult ? publish('not-available') : snapshot;
    } catch {
      return announceResult
        ? publish('error', {
            message: navigator.onLine ? '暂时无法检查更新，请稍后重试。' : '当前处于离线状态，联网后可再检查更新。',
          })
        : snapshot;
    }
  };

  const api: PwaUpdaterApi = {
    getUpdateState: () => snapshot,
    checkForUpdates: () => runCheck(true),
    applyUpdate: () => {
      const worker = waitingWorker ?? registration?.waiting ?? null;
      if (!worker) return false;
      worker.postMessage({ type: SKIP_WAITING_MESSAGE });
      return true;
    },
    subscribeUpdateState: (listener) => {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
  };
  window.boardPwaUpdates = api;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const isControlled = Boolean(navigator.serviceWorker.controller);
    if (hadController && isControlled) window.location.reload();
    hadController = isControlled;
  });

  const register = async (): Promise<void> => {
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => {
        if (registration?.installing) observeWorker(registration.installing);
      });
      if (registration.waiting) {
        waitingWorker = registration.waiting;
        if (navigator.serviceWorker.controller) publish('available', { action: 'refresh' });
      }
      if (registration.installing) observeWorker(registration.installing);
      void runCheck(false);
      window.setInterval(() => void runCheck(false), UPDATE_INTERVAL_MS);
    } catch {
      // Offline or unsupported service-worker registration should not block the whiteboard.
    }
  };

  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
