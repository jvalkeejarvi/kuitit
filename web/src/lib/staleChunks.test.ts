import { reloadOnStaleChunks } from './staleChunks';

describe('reloadOnStaleChunks', () => {
  const reload = vi.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });
    reloadOnStaleChunks();
  });

  beforeEach(() => {
    reload.mockReset();
    sessionStorage.clear();
  });

  const preloadError = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it('reloads once when a chunk from an older release fails to load', () => {
    expect(preloadError().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();

    // Still failing after the reload: let the error surface instead of looping.
    expect(preloadError().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});
