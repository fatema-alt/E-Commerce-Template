import { describe, expect, it } from 'vitest';
import assert from 'node:assert';
import { heroSlides } from '../../../storefront/src/lib/hero-slides.js';

describe('heroSlides adapter and backwards compatibility', () => {
  it('maps legacy slides without themePreset gracefully', () => {
    const config = {
      slides: [
        { title: 'Legacy Lime', theme: 'lime', enabled: true },
        { title: 'Legacy Blue', theme: 'blue', enabled: true },
        { title: 'Legacy Pink', theme: 'pink', enabled: true },
      ]
    };
    const slides = heroSlides(config as any, []);
    expect(slides[0].themePreset).toBe('lime');
    expect(slides[0].gradient).toContain('#eef5d5');
    expect(slides[1].themePreset).toBe('light');
    expect(slides[1].gradient).toContain('#dff3fc');
    expect(slides[2].themePreset).toBe('light');
    expect(slides[2].gradient).toContain('#fae6ef');
  });

  it('preserves custom gradient over preset if provided', () => {
    const customGrad = 'linear-gradient(135deg, #112233, #445566)';
    const config = {
      slides: [
        { title: 'Custom Grad', backgroundGradient: customGrad, themePreset: 'dark' }
      ]
    };
    const slides = heroSlides(config as any, []);
    expect(slides[0].gradient).toBe(customGrad);
    expect(slides[0].themePreset).toBe('dark');
  });

  it('validates customTheme and falls back safely if invalid', () => {
    const config = {
      slides: [
        {
          title: 'Valid Custom',
          themePreset: 'custom',
          customTheme: { bg: '#123456', text: '#ffffff', accent: '#d8f45a' }
        },
        {
          title: 'Invalid Custom Hex',
          themePreset: 'custom',
          customTheme: { bg: 'invalid', text: '#fff', accent: '#000' }
        }
      ]
    };
    const slides = heroSlides(config as any, []);
    expect(slides[0].customTheme).toEqual({ bg: '#123456', text: '#ffffff', accent: '#d8f45a' });
    expect(slides[1].customTheme).toBeUndefined();
  });

  it('respects imageBackdrop options', () => {
    const config = {
      slides: [
        { title: 'Ring', imageBackdrop: 'lime_ring' },
        { title: 'Circle', imageBackdrop: 'circle' },
        { title: 'Default', imageBackdrop: 'none' },
      ]
    };
    const slides = heroSlides(config as any, []);
    expect(slides[0].imageBackdrop).toBe('lime_ring');
    expect(slides[1].imageBackdrop).toBe('circle');
    expect(slides[2].imageBackdrop).toBe('none');
  });
});
