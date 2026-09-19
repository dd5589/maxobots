export function installDevBridge() {
  if (typeof window === 'undefined' || window.WebApp) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const startParam =
    params.get('startapp') ||
    params.get('start_param') ||
    '';

  window.WebApp = {
    __dev: true,
    initData: 'dev-init-data',
    initDataUnsafe: {
      user: {
        id: 'dev-user',
        first_name: 'Dev',
      },
      start_param: startParam,
    },
    platform: 'web',
    version: 'dev',
    close: () => console.log('[devBridge] close()'),
    openLink: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    ready: () => {},
  };

  console.warn(
    '[devBridge] Активирован dev-режим. Для API включите ALLOW_DEV_AUTH=true на backend.'
  );
}
