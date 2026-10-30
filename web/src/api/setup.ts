import { client } from './client/client.gen';

export const CSRF_HEADER = 'X-CSRF';

export function loginUrl(returnUrl: string = window.location.pathname + window.location.search): string {
  return `/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** Same-origin calls; the session is the HttpOnly cookie. Mutations carry the CSRF header the API requires. */
export function configureApiClient(): void {
  client.setConfig({ baseUrl: '', credentials: 'same-origin' });
  client.interceptors.request.use(request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.headers.set(CSRF_HEADER, '1');
    }
    return request;
  });
  client.interceptors.response.use(response => {
    // Session expired mid-use: start a fresh login and come back here.
    if (response.status === 401 && !response.url.endsWith('/api/me')) {
      window.location.assign(loginUrl());
    }
    return response;
  });
}

export function receiptFileUrl(id: string): string {
  return `/api/receipts/${id}/file`;
}
