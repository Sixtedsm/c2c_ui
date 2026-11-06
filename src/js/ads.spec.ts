// The ad script starts once, and only after the page has loaded: injected when the ad components were imported, it ran
// at every start of the app, ahead of the app's own first render and before its slot existed
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adScripts = () => document.querySelectorAll<HTMLScriptElement>('script#ad_script');

describe('loadAdScript', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.head.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits for the load event, then adds the script once', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const { loadAdScript } = await import('./ads');

    loadAdScript();
    loadAdScript(); // a second slot on the same page
    vi.runAllTimers();
    expect(adScripts()).toHaveLength(0);

    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();
    expect(adScripts()).toHaveLength(1);
  });

  it('adds it at once (when the browser is idle) on a page already loaded', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    const { loadAdScript } = await import('./ads');

    loadAdScript();
    vi.runAllTimers();
    expect(adScripts()).toHaveLength(1);
    expect(adScripts()[0].src).toContain('admysports.com');
  });
});
