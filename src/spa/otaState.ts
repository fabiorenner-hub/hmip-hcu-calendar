import { signal } from '@preact/signals';
import { api, type OtaStatus } from './api.js';

/** undefined = loading, null = OTA unavailable (503), else the status. */
export const otaStatus = signal<OtaStatus | null | undefined>(undefined);
export const otaBusy = signal(false); // for the "check now" button only

export type OtaStep = 'idle' | 'installing' | 'restarting' | 'verifying' | 'done' | 'timeout';
export const otaStep = signal<OtaStep>('idle');
/** 0..100 for the progress bar. */
export const otaProgress = signal(0);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function loadOtaStatus(): Promise<void> {
  try {
    otaStatus.value = await api.otaStatus();
  } catch {
    otaStatus.value = null;
  }
}

export async function otaCheck(): Promise<void> {
  otaBusy.value = true;
  try {
    otaStatus.value = await api.otaCheck();
  } catch {
    // keep previous status
  } finally {
    otaBusy.value = false;
  }
}

/**
 * Robust install flow. Locks itself against re-entry, drives a progress bar and
 * — crucially — treats the connection dropping during the restart as expected
 * (that was the "failed to fetch" the user saw). It polls until the server is
 * back on the NEW version, then reloads the page so the browser gets the new
 * SPA bundle. No second click is possible while a flow is running.
 */
export async function otaInstall(): Promise<void> {
  if (otaStep.value !== 'idle') return; // hard re-entry guard

  const before = otaStatus.value?.otaVersion ?? '';
  otaStep.value = 'installing';
  otaProgress.value = 8;

  try {
    // The server accepts, then restarts ~0.5s later; this request may or may
    // not return before the socket drops — both are fine.
    await api.otaInstall();
  } catch {
    // Expected when the server restarts mid-request.
  }

  otaStep.value = 'restarting';
  otaProgress.value = 25;

  // Give the process time to actually exit before we start polling, so we do
  // not immediately "succeed" against the old instance.
  await sleep(3500);

  const start = Date.now();
  const MAX_MS = 90_000;
  while (Date.now() - start < MAX_MS) {
    const frac = (Date.now() - start) / MAX_MS;
    otaProgress.value = Math.min(92, 25 + frac * 67);
    try {
      const s = await api.otaStatus();
      // Back up. Done when the running version advanced or there is no pending
      // update anymore (installed == latest).
      if (s.otaVersion !== before || !s.updateAvailable) {
        otaStatus.value = s;
        otaStep.value = 'verifying';
        otaProgress.value = 96;
        await sleep(900);
        otaStep.value = 'done';
        otaProgress.value = 100;
        await sleep(1200);
        location.reload();
        return;
      }
    } catch {
      // Still down / restarting — keep waiting (this is NOT a failure).
    }
    await sleep(2000);
  }

  // Took unusually long — let the user reload manually.
  otaStep.value = 'timeout';
}

export function otaReset(): void {
  otaStep.value = 'idle';
  otaProgress.value = 0;
}
