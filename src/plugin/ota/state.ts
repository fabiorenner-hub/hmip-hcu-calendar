/**
 * OTA state (`/data/ota/state.json`) — crash-loop bookkeeping shared (by file)
 * between the bootstrap loader and the running payload. Server-side accessor
 * (zod-validated, atomic writer). The loader ships its own dependency-free
 * reader/writer of the SAME shape so it never imports app code / node_modules.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '../../persistence/_atomic.js';

export const OtaStateSchema = z.object({
  activeVersion: z.string().nullable().default(null),
  bootAttempts: z.number().int().min(0).default(0),
  lastGoodAt: z.string().nullable().default(null),
  quarantined: z.array(z.string()).default([]),
});

export type OtaState = z.infer<typeof OtaStateSchema>;

export function emptyOtaState(): OtaState {
  return { activeVersion: null, bootAttempts: 0, lastGoodAt: null, quarantined: [] };
}

export function otaStatePath(dataDir: string): string {
  return path.join(dataDir, 'ota', 'state.json');
}

export async function readOtaState(dataDir: string): Promise<OtaState> {
  try {
    const raw = await fs.readFile(otaStatePath(dataDir), 'utf8');
    const parsed = OtaStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyOtaState();
  } catch {
    return emptyOtaState();
  }
}

export async function writeOtaState(dataDir: string, state: OtaState): Promise<void> {
  await atomicWriteJson(otaStatePath(dataDir), state);
}
