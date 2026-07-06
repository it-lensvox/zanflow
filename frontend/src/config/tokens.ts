// ─── Global Design Tokens ─────────────────────────────────────────────────────
// Single source of truth for all design tokens across the entire application.
// Import from here instead of declaring local const BLUE/TEXT/MUTED in each file.

// ── Brand Colors
export const BLUE   = '#1663f6';   // Primary brand blue (Tasks, Projects, Calendar, Dashboard)
export const DOCS_BLUE = '#4169FF'; // Documents accent — intentionally distinct from BLUE

// ── Neutral Palette
export const TEXT   = '#172033';   // Primary text
export const MUTED  = '#667085';   // Secondary / placeholder text
export const LINE   = '#e6ebf2';   // Borders, dividers
export const BG     = '#F7F8FB';   // Page background
export const SURFACE = '#FFFFFF';  // Card / panel background

// ── Semantic Colors (used in badges, charts, status dots)
export const GREEN  = '#22C55E';
export const YELLOW = '#F59E0B';
export const RED    = '#EF4444';
export const PURPLE = '#8B5CF6';
export const CYAN   = '#06B6D4';
export const PINK   = '#EC4899';
export const ORANGE = '#F97316';
export const INDIGO = '#6366F1';