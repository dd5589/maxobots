function getWebApp() {
  return window.WebApp ?? null;
}

export function getRawInitData() {
  return getWebApp()?.initData ?? '';
}

function normalizeStartParam(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    return value.payload ?? value.value ?? value.id ?? '';
  }

  return '';
}

export function getStartParam() {
  const webApp = getWebApp();

  if (webApp) {
    const value = normalizeStartParam(webApp.initDataUnsafe?.start_param);

    if (value) {
      return value;
    }
  }

  const url = new URL(window.location.href);

  return (
    url.searchParams.get('startapp') ||
    url.searchParams.get('start_param') ||
    ''
  );
}

export function getUser() {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function prepareWebApp() {
  const webApp = getWebApp();

  if (!webApp) {
    return;
  }

  webApp.ready?.();
}
