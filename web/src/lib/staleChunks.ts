const reloadedKey = 'kuitit.chunkReload';

/**
 * A tab opened before a deploy still references the old release's chunk names, which no longer exist. Vite
 * raises `vite:preloadError` when such an import fails: reload once to pick up the new index.html. The
 * sessionStorage mark stops a reload loop if the chunk is missing for some other reason.
 */
export function reloadOnStaleChunks(): void {
  window.addEventListener('vite:preloadError', event => {
    if (alreadyReloaded()) return;
    event.preventDefault();
    markReloaded();
    window.location.reload();
  });
  // A successful load means this version works; allow a reload for the next deploy.
  window.addEventListener('load', () => setTimeout(clearMark, 10_000));
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(reloadedKey) === '1';
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(reloadedKey, '1');
  } catch {
    // Without storage there is no loop guard; still better to try once.
  }
}

function clearMark(): void {
  try {
    sessionStorage.removeItem(reloadedKey);
  } catch {
    // Nothing to clear.
  }
}
