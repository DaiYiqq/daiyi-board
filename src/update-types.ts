export type UpdateSource = 'desktop' | 'pwa';
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'unsupported'
  | 'error';
export type UpdateAction = 'download' | 'release' | 'refresh';

export interface UpdateSnapshot {
  source: UpdateSource;
  status: UpdateStatus;
  action?: UpdateAction;
  version?: string;
  percent?: number;
  message?: string;
}

export interface DesktopUpdaterApi {
  platform: string;
  version: string;
  quit: () => Promise<boolean>;
  getUpdateState: () => Promise<UpdateSnapshot>;
  checkForUpdates: () => Promise<boolean>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  openReleasePage: () => Promise<boolean>;
  subscribeUpdateState: (listener: (state: UpdateSnapshot) => void) => () => void;
}

export interface PwaUpdaterApi {
  getUpdateState: () => UpdateSnapshot;
  checkForUpdates: () => Promise<UpdateSnapshot>;
  applyUpdate: () => boolean;
  subscribeUpdateState: (listener: (state: UpdateSnapshot) => void) => () => void;
}

declare global {
  interface Window {
    boardDesktop?: DesktopUpdaterApi;
    boardPwaUpdates?: PwaUpdaterApi;
  }
}
