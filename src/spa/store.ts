import { signal } from '@preact/signals';
import { api, type Config } from './api.js';

export const config = signal<Config | null>(null);
export const configLoading = signal(true);
export const configError = signal<string | null>(null);
export const saving = signal(false);
export const saveError = signal<string | null>(null);

export async function loadConfig(): Promise<void> {
  configLoading.value = true;
  configError.value = null;
  try {
    config.value = await api.getConfig();
  } catch (err) {
    configError.value = (err as Error).message;
  } finally {
    configLoading.value = false;
  }
}

export async function saveConfig(next: Config): Promise<boolean> {
  saving.value = true;
  saveError.value = null;
  try {
    config.value = await api.putConfig(next);
    return true;
  } catch (err) {
    saveError.value = (err as Error).message;
    return false;
  } finally {
    saving.value = false;
  }
}

/** Shallow update helper that persists immediately. */
export async function patchConfig(patch: Partial<Config>): Promise<boolean> {
  if (!config.value) return false;
  return saveConfig({ ...config.value, ...patch });
}
