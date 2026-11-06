// The header-bidding script of the ads sets off ~35 requests to ~20 ad networks and over a second of main-thread work
// on a mid-range phone (Lighthouse, 2026-11-05: 1.4 s of the 2.1-2.7 s blocking time of a page). It starts once, when
// a slot is in the page and the page has finished loading: the app's own first render and first taps go first.
const AD_SCRIPT_URL = 'https://static.admysports.com/hb/site/camptocamp/hb_camptocamp.js';

let requested = false;

export function loadAdScript() {
  if (requested || document.getElementById('ad_script')) {
    return;
  }
  requested = true;

  const inject = () => {
    const script = document.createElement('script');
    script.id = 'ad_script';
    script.src = AD_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  };
  // Safari has no requestIdleCallback
  const whenIdle = () =>
    'requestIdleCallback' in window ? window.requestIdleCallback(inject, { timeout: 3000 }) : setTimeout(inject, 0);

  if (document.readyState === 'complete') {
    whenIdle();
  } else {
    window.addEventListener('load', whenIdle, { once: true });
  }
}
