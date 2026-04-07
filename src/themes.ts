/**
 * Theme definitions for the Worldbook Assistant panel.
 * Design System: Obsidian Architect — "The Midnight Monolith"
 *
 * Core principles:
 * - Surface Hierarchy: depth via tonal layering, not borders
 * - No-Line Rule: boundaries through background shifts, not 1px borders
 * - Micro-Glass: floating menus only, subtle backdrop blur
 * - Signature Gradient: primary CTA uses liquid-light gradient
 *
 * Token naming follows Material Surface convention.
 */

export type ThemeKey = 'obsidian' | 'glacier' | 'ember' | 'verdant' | 'paper' | 'snow';
export const DEFAULT_THEME_KEY: ThemeKey = 'obsidian';

/**
 * Maps legacy theme keys to new theme keys for migration.
 */
export const LEGACY_THEME_MAP: Record<string, ThemeKey> = {
  ocean: 'obsidian',
  nebula: 'obsidian',
  forest: 'verdant',
  sunset: 'ember',
  coffee: 'ember',
  paper: 'paper',
  snow: 'snow',
  midnight: 'obsidian',
};

export const THEMES: Record<ThemeKey, { name: string; label: string; colors: Record<string, string> }> = {
  obsidian: {
    name: 'Obsidian',
    label: '黑曜石',
    colors: {
      // ── Surface Hierarchy ──
      '--wb-bg-root': '#131318',          // surface
      '--wb-bg-panel': '#1F1F24',         // surface_container
      '--wb-surface-low': '#1B1B20',      // surface_container_low
      '--wb-surface-high': '#2A292F',     // surface_container_high
      '--wb-surface-highest': '#35343A',  // surface_container_highest
      '--wb-surface-bright': '#39393E',   // surface_bright (hover)
      // ── Text ──
      '--wb-text-main': '#E4E1E9',        // on_surface
      '--wb-text-muted': '#C8C4D7',       // on_surface_variant
      // ── Primary ──
      '--wb-primary': '#C6BFFF',          // primary
      '--wb-primary-light': '#E4DFFF',    // primary_fixed
      '--wb-primary-container': '#6C5CE7', // primary_container (accent)
      '--wb-primary-hover': 'rgba(108, 92, 231, 0.15)',
      '--wb-primary-soft': 'rgba(198, 191, 255, 0.1)',
      '--wb-primary-glow': '0 0 12px rgba(108, 92, 231, 0.15)',
      // ── Semantic ──
      '--wb-success': '#4EDEA3',           // tertiary
      '--wb-success-container': '#008259', // tertiary_container
      '--wb-error': '#FFB4AB',             // error
      '--wb-error-container': '#93000A',   // error_container
      '--wb-secondary': '#ADC6FF',         // secondary
      '--wb-secondary-container': '#0566D9', // secondary_container
      // ── Input / Interactive ──
      '--wb-input-bg': '#0E0E13',          // surface_container_lowest (recessed well)
      '--wb-input-bg-hover': '#1B1B20',
      '--wb-input-bg-focus': '#0E0E13',
      // ── Borders (Ghost Borders — felt, not seen) ──
      '--wb-border-subtle': 'rgba(71, 69, 84, 0.15)',  // outline_variant at 15%
      '--wb-border-main': 'rgba(71, 69, 84, 0.25)',    // outline_variant at 25%
      // ── Shadows & Elevation ──
      '--wb-shadow-main': '0 20px 40px rgba(0, 0, 0, 0.4)',
      '--wb-shadow-ambient': '0 8px 24px rgba(0, 0, 0, 0.3)',
      // ── Scrollbar & Overlay ──
      '--wb-scrollbar-thumb': 'rgba(198, 191, 255, 0.15)',
      '--wb-overlay-bg': 'rgba(0, 0, 0, 0.5)',
      '--wb-dropdown-bg': 'rgba(31, 31, 36, 0.92)',
      // ── Gradient (Signature CTA) ──
      '--wb-gradient-primary': 'linear-gradient(135deg, #6C5CE7, #008259)',
    },
  },

  glacier: {
    name: 'Glacier',
    label: '冰川',
    colors: {
      '--wb-bg-root': '#0E1521',
      '--wb-bg-panel': '#1A2332',
      '--wb-surface-low': '#152030',
      '--wb-surface-high': '#243345',
      '--wb-surface-highest': '#2E3D4F',
      '--wb-surface-bright': '#344559',
      '--wb-text-main': '#E1EAF4',
      '--wb-text-muted': '#8BA3BF',
      '--wb-primary': '#7EC8E3',
      '--wb-primary-light': '#B4E0F0',
      '--wb-primary-container': '#2980B9',
      '--wb-primary-hover': 'rgba(41, 128, 185, 0.15)',
      '--wb-primary-soft': 'rgba(126, 200, 227, 0.1)',
      '--wb-primary-glow': '0 0 12px rgba(41, 128, 185, 0.15)',
      '--wb-success': '#4EDEA3',
      '--wb-success-container': '#008259',
      '--wb-error': '#FFB4AB',
      '--wb-error-container': '#93000A',
      '--wb-secondary': '#A8D8EA',
      '--wb-secondary-container': '#1A6B8A',
      '--wb-input-bg': '#0A1018',
      '--wb-input-bg-hover': '#152030',
      '--wb-input-bg-focus': '#0A1018',
      '--wb-border-subtle': 'rgba(107, 139, 168, 0.12)',
      '--wb-border-main': 'rgba(107, 139, 168, 0.22)',
      '--wb-shadow-main': '0 20px 40px rgba(0, 0, 0, 0.4)',
      '--wb-shadow-ambient': '0 8px 24px rgba(0, 0, 0, 0.3)',
      '--wb-scrollbar-thumb': 'rgba(126, 200, 227, 0.15)',
      '--wb-overlay-bg': 'rgba(0, 0, 0, 0.5)',
      '--wb-dropdown-bg': 'rgba(26, 35, 50, 0.92)',
      '--wb-gradient-primary': 'linear-gradient(135deg, #2980B9, #008259)',
    },
  },

  ember: {
    name: 'Ember',
    label: '余烬',
    colors: {
      '--wb-bg-root': '#171111',
      '--wb-bg-panel': '#231919',
      '--wb-surface-low': '#1E1515',
      '--wb-surface-high': '#2F2323',
      '--wb-surface-highest': '#3A2C2C',
      '--wb-surface-bright': '#423232',
      '--wb-text-main': '#F2E4E4',
      '--wb-text-muted': '#D4A0A0',
      '--wb-primary': '#FF9B7A',
      '--wb-primary-light': '#FFCBB4',
      '--wb-primary-container': '#D94E1F',
      '--wb-primary-hover': 'rgba(217, 78, 31, 0.15)',
      '--wb-primary-soft': 'rgba(255, 155, 122, 0.1)',
      '--wb-primary-glow': '0 0 12px rgba(217, 78, 31, 0.15)',
      '--wb-success': '#4EDEA3',
      '--wb-success-container': '#008259',
      '--wb-error': '#FFB4AB',
      '--wb-error-container': '#93000A',
      '--wb-secondary': '#FBBF24',
      '--wb-secondary-container': '#B45309',
      '--wb-input-bg': '#120C0C',
      '--wb-input-bg-hover': '#1E1515',
      '--wb-input-bg-focus': '#120C0C',
      '--wb-border-subtle': 'rgba(140, 90, 90, 0.12)',
      '--wb-border-main': 'rgba(140, 90, 90, 0.22)',
      '--wb-shadow-main': '0 20px 40px rgba(0, 0, 0, 0.4)',
      '--wb-shadow-ambient': '0 8px 24px rgba(0, 0, 0, 0.3)',
      '--wb-scrollbar-thumb': 'rgba(255, 155, 122, 0.15)',
      '--wb-overlay-bg': 'rgba(0, 0, 0, 0.5)',
      '--wb-dropdown-bg': 'rgba(35, 25, 25, 0.92)',
      '--wb-gradient-primary': 'linear-gradient(135deg, #D94E1F, #B45309)',
    },
  },

  verdant: {
    name: 'Verdant',
    label: '翠绿',
    colors: {
      '--wb-bg-root': '#0D1712',
      '--wb-bg-panel': '#162219',
      '--wb-surface-low': '#121E16',
      '--wb-surface-high': '#1F2E24',
      '--wb-surface-highest': '#28392D',
      '--wb-surface-bright': '#304236',
      '--wb-text-main': '#E2F2E8',
      '--wb-text-muted': '#86BFA0',
      '--wb-primary': '#6EE7B7',
      '--wb-primary-light': '#A7F3D0',
      '--wb-primary-container': '#059669',
      '--wb-primary-hover': 'rgba(5, 150, 105, 0.15)',
      '--wb-primary-soft': 'rgba(110, 231, 183, 0.1)',
      '--wb-primary-glow': '0 0 12px rgba(5, 150, 105, 0.15)',
      '--wb-success': '#4EDEA3',
      '--wb-success-container': '#008259',
      '--wb-error': '#FFB4AB',
      '--wb-error-container': '#93000A',
      '--wb-secondary': '#7DD3FC',
      '--wb-secondary-container': '#0369A1',
      '--wb-input-bg': '#081009',
      '--wb-input-bg-hover': '#121E16',
      '--wb-input-bg-focus': '#081009',
      '--wb-border-subtle': 'rgba(80, 130, 100, 0.12)',
      '--wb-border-main': 'rgba(80, 130, 100, 0.22)',
      '--wb-shadow-main': '0 20px 40px rgba(0, 0, 0, 0.4)',
      '--wb-shadow-ambient': '0 8px 24px rgba(0, 0, 0, 0.3)',
      '--wb-scrollbar-thumb': 'rgba(110, 231, 183, 0.15)',
      '--wb-overlay-bg': 'rgba(0, 0, 0, 0.5)',
      '--wb-dropdown-bg': 'rgba(22, 34, 25, 0.92)',
      '--wb-gradient-primary': 'linear-gradient(135deg, #059669, #0369A1)',
    },
  },

  paper: {
    name: 'Paper',
    label: '纸莎草',
    colors: {
      '--wb-bg-root': '#FAF8F3',
      '--wb-bg-panel': '#F0EBE0',
      '--wb-surface-low': '#F5F0E8',
      '--wb-surface-high': '#E8E2D5',
      '--wb-surface-highest': '#DDD7C8',
      '--wb-surface-bright': '#D5CEC0',
      '--wb-text-main': '#3D3328',
      '--wb-text-muted': '#8C7B6A',
      '--wb-primary': '#B45309',
      '--wb-primary-light': '#D97706',
      '--wb-primary-container': '#D97706',
      '--wb-primary-hover': 'rgba(180, 83, 9, 0.1)',
      '--wb-primary-soft': 'rgba(180, 83, 9, 0.08)',
      '--wb-primary-glow': '0 0 12px rgba(180, 83, 9, 0.12)',
      '--wb-success': '#059669',
      '--wb-success-container': '#065F46',
      '--wb-error': '#DC2626',
      '--wb-error-container': '#FEE2E2',
      '--wb-secondary': '#0369A1',
      '--wb-secondary-container': '#BAE6FD',
      '--wb-input-bg': '#FFFFFF',
      '--wb-input-bg-hover': '#F5F0E8',
      '--wb-input-bg-focus': '#FFFFFF',
      '--wb-border-subtle': 'rgba(61, 51, 40, 0.08)',
      '--wb-border-main': 'rgba(61, 51, 40, 0.14)',
      '--wb-shadow-main': '0 8px 24px rgba(61, 51, 40, 0.1)',
      '--wb-shadow-ambient': '0 4px 12px rgba(61, 51, 40, 0.06)',
      '--wb-scrollbar-thumb': 'rgba(61, 51, 40, 0.2)',
      '--wb-overlay-bg': 'rgba(61, 51, 40, 0.3)',
      '--wb-dropdown-bg': 'rgba(250, 248, 243, 0.95)',
      '--wb-gradient-primary': 'linear-gradient(135deg, #D97706, #059669)',
    },
  },

  snow: {
    name: 'Snow',
    label: '雪白',
    colors: {
      '--wb-bg-root': '#FFFFFF',
      '--wb-bg-panel': '#F5F5F7',
      '--wb-surface-low': '#FAFAFA',
      '--wb-surface-high': '#EBEBEF',
      '--wb-surface-highest': '#E0E0E5',
      '--wb-surface-bright': '#D8D8DD',
      '--wb-text-main': '#1A1A2E',
      '--wb-text-muted': '#6B6B80',
      '--wb-primary': '#4F46E5',
      '--wb-primary-light': '#6366F1',
      '--wb-primary-container': '#4F46E5',
      '--wb-primary-hover': 'rgba(79, 70, 229, 0.08)',
      '--wb-primary-soft': 'rgba(79, 70, 229, 0.06)',
      '--wb-primary-glow': '0 0 12px rgba(79, 70, 229, 0.1)',
      '--wb-success': '#059669',
      '--wb-success-container': '#065F46',
      '--wb-error': '#DC2626',
      '--wb-error-container': '#FEE2E2',
      '--wb-secondary': '#2563EB',
      '--wb-secondary-container': '#DBEAFE',
      '--wb-input-bg': '#FFFFFF',
      '--wb-input-bg-hover': '#FAFAFA',
      '--wb-input-bg-focus': '#FFFFFF',
      '--wb-border-subtle': 'rgba(26, 26, 46, 0.06)',
      '--wb-border-main': 'rgba(26, 26, 46, 0.12)',
      '--wb-shadow-main': '0 8px 24px rgba(26, 26, 46, 0.08)',
      '--wb-shadow-ambient': '0 4px 12px rgba(26, 26, 46, 0.04)',
      '--wb-scrollbar-thumb': 'rgba(26, 26, 46, 0.18)',
      '--wb-overlay-bg': 'rgba(26, 26, 46, 0.3)',
      '--wb-dropdown-bg': 'rgba(255, 255, 255, 0.95)',
      '--wb-gradient-primary': 'linear-gradient(135deg, #4F46E5, #2563EB)',
    },
  },
};

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in THEMES;
}

/**
 * Migrates a legacy theme key to the new theme system.
 * Returns the new key if migration needed, original key if already valid.
 */
export function migrateThemeKey(value: string): ThemeKey {
  if (isThemeKey(value)) {
    return value;
  }
  return LEGACY_THEME_MAP[value] ?? DEFAULT_THEME_KEY;
}
