// Globaler Spielzustand
export const G = {
  time: 0,           // Echtzeit seit Start (s)
  mode: 'loading',   // loading | menu | play | pause | cutscene | minigame
  handlers: {},
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); },
  emit(ev, data) { for (const f of this.handlers[ev] || []) f(data); },
};
export const DEFAULT_SETTINGS = {
  quality: 'high', fov: 70, sens: 1.0, invertY: false, master: 0.8, sfx: 0.9, music: 0.6, dayLen: 24, traffic: 1, peds: 1, fps: false, shake: true, hud: true, touch: 'auto', name: '', lastRoom: '',
};
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('vc_settings') || '{}')) }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { try { localStorage.setItem('vc_settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }
