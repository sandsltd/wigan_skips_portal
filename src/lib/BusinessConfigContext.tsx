'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface BusinessConfig {
  businessName: string;
  phoneNumber: string;
  emailAddress: string;
  websiteUrl: string;
  logoUrl: string;
  portalUrl: string;
  tagline: string;
  primaryColor: string;
  sectionBackgroundColor: string;
}

const defaultConfig: BusinessConfig = {
  businessName: '',
  phoneNumber: '',
  emailAddress: '',
  websiteUrl: '',
  logoUrl: '',
  portalUrl: '',
  tagline: '',
  primaryColor: '',
  sectionBackgroundColor: '',
};

const BusinessConfigContext = createContext<BusinessConfig>(defaultConfig);

export function useBusinessConfig() {
  return useContext(BusinessConfigContext);
}

// Generate lighter and darker variants from a hex color
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function injectCSSVariables(primaryColor: string) {
  const hsl = hexToHSL(primaryColor);
  const light = hslToHex(hsl.h, Math.min(hsl.s + 10, 100), Math.min(hsl.l + 15, 85));
  const dark = hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 12, 10));

  const root = document.documentElement;
  root.style.setProperty('--color-primary', primaryColor);
  root.style.setProperty('--color-primary-light', light);
  root.style.setProperty('--color-primary-dark', dark);
  root.style.setProperty('--color-primary-rgba-008', hexToRgba(primaryColor, 0.08));
  root.style.setProperty('--color-primary-rgba-006', hexToRgba(primaryColor, 0.06));
  root.style.setProperty('--color-primary-rgba-01', hexToRgba(primaryColor, 0.1));

  // Update theme-color meta tag
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', primaryColor);
  }
}

export function BusinessConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BusinessConfig | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setConfig(data);
          injectCSSVariables(data.primaryColor);
        } else {
          setConfig(defaultConfig);
          injectCSSVariables(defaultConfig.primaryColor);
        }
      })
      .catch(() => {
        setConfig(defaultConfig);
        injectCSSVariables(defaultConfig.primaryColor);
      });
  }, []);

  if (!config) {
    // Show nothing until config is loaded to avoid flash of wrong branding
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-cream, #f8f5f0)',
        }}
      />
    );
  }

  return (
    <BusinessConfigContext.Provider value={config}>
      {children}
    </BusinessConfigContext.Provider>
  );
}
