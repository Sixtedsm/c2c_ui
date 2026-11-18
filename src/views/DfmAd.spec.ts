import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DfmAdLarge from './DfmAdLarge.vue';
import DfmAdSmall from './DfmAdSmall.vue';

import { loadAdScript } from '@/js/ad-script';

vi.mock('@/js/ad-script', () => ({ loadAdScript: vi.fn() }));

describe.each([
  ['DfmAdSmall', DfmAdSmall, 'camptocamp_htd'],
  ['DfmAdLarge', DfmAdLarge, 'camptocamp_htad'],
])('%s', (_name, component, divId) => {
  beforeEach(() => {
    vi.mocked(loadAdScript).mockClear();
    // jsdom has no layout
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  it('asks for the ad script only once its div is in the page', () => {
    // importing the component is not enough: the ad script displays its slots as soon as it runs
    expect(loadAdScript).not.toHaveBeenCalled();

    let divInPage = false;
    vi.mocked(loadAdScript).mockImplementation(() => {
      divInPage = document.getElementById(divId) !== null;
    });
    const wrapper = mount(component, { attachTo: document.body });

    expect(loadAdScript).toHaveBeenCalledOnce();
    expect(divInPage).toBe(true);
    wrapper.unmount();
  });
});

describe('DfmAdSmall', () => {
  it('scales an ad wider than its room down to it, whole, and leaves one that fits as it is', () => {
    let fit = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          fit = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const wrapper = mount(DfmAdSmall, { attachTo: document.body });
    const room = wrapper.get('.ad-room').element as HTMLElement;
    const ad = wrapper.get('#camptocamp_htd').element as HTMLElement;
    // jsdom has no layout: the banner of 728 x 90 px the ad network gives to a page whose url is not "/", in a column
    // of 364 px
    room.style.padding = '0px';
    Object.defineProperty(room, 'clientWidth', { value: 364 });
    Object.defineProperty(ad, 'offsetHeight', { value: 90 });
    Object.defineProperty(ad, 'offsetWidth', { value: 728, configurable: true });
    fit();
    expect(ad.style.transform).toBe('scale(0.5)');
    expect(ad.style.marginBottom).toBe('-45px');

    Object.defineProperty(ad, 'offsetWidth', { value: 300 });
    fit();
    expect(ad.style.transform).toBe('');
    expect(ad.style.marginBottom).toBe('');
    wrapper.unmount();
  });
});
