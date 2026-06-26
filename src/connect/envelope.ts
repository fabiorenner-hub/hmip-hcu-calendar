import { randomUUID } from 'node:crypto';

/**
 * Connect API message envelope. Per spec §6.2.1 it has exactly four fields:
 * id, pluginId, type and body.
 */
export interface PluginMessage<T = unknown> {
  id: string;
  pluginId: string;
  type: string;
  body: T;
}

/** Feature shape we emit/consume. SwitchState per spec §6.7.36. */
export interface SwitchStateFeature {
  type: 'switchState';
  on: boolean;
}

/** Device archetype SWITCH per spec §6.6.5. */
export interface ConnectDevice {
  deviceId: string;
  deviceType: 'SWITCH';
  features: SwitchStateFeature[];
  modelType?: string;
  firmwareVersion?: string;
  friendlyName?: string;
}

/** Message types received from the Home Control Unit that we handle. */
export const IncomingType = {
  DISCOVER_REQUEST: 'DISCOVER_REQUEST',
  CONTROL_REQUEST: 'CONTROL_REQUEST',
  STATUS_REQUEST: 'STATUS_REQUEST',
  PLUGIN_STATE_REQUEST: 'PLUGIN_STATE_REQUEST',
  CONFIG_TEMPLATE_REQUEST: 'CONFIG_TEMPLATE_REQUEST',
  CONFIG_UPDATE_REQUEST: 'CONFIG_UPDATE_REQUEST',
} as const;

/** Message types we send to the Home Control Unit. */
export const OutgoingType = {
  DISCOVER_RESPONSE: 'DISCOVER_RESPONSE',
  CONTROL_RESPONSE: 'CONTROL_RESPONSE',
  STATUS_RESPONSE: 'STATUS_RESPONSE',
  STATUS_EVENT: 'STATUS_EVENT',
  PLUGIN_STATE_RESPONSE: 'PLUGIN_STATE_RESPONSE',
  CONFIG_TEMPLATE_RESPONSE: 'CONFIG_TEMPLATE_RESPONSE',
  CONFIG_UPDATE_RESPONSE: 'CONFIG_UPDATE_RESPONSE',
} as const;

/** PluginReadinessStatus per spec §6.6.9 (only these three values are valid). */
export type PluginReadinessStatus = 'CONFIG_REQUIRED' | 'ERROR' | 'READY';

export function makeEnvelope<T>(
  pluginId: string,
  type: string,
  body: T,
  id: string = randomUUID(),
): PluginMessage<T> {
  return { id, pluginId, type, body };
}

export function switchDevice(
  deviceId: string,
  on: boolean,
  friendlyName: string,
  firmwareVersion: string,
): ConnectDevice {
  return {
    deviceId,
    deviceType: 'SWITCH',
    features: [{ type: 'switchState', on }],
    modelType: 'CAL-VDEV',
    firmwareVersion,
    friendlyName,
  };
}

/** Safely extract a deviceId from an incoming control/status request body. */
export function readDeviceId(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'deviceId' in body) {
    const v = (body as { deviceId?: unknown }).deviceId;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

/**
 * Defensively read a target switchState.on from a ControlRequest body. Returns
 * undefined when no switchState feature with an `on` flag is present. Never
 * validates the whole object strictly (eQ-3 keeps extending fields).
 */
export function readSwitchTarget(body: unknown): boolean | undefined {
  if (!body || typeof body !== 'object' || !('features' in body)) return undefined;
  const features = (body as { features?: unknown }).features;
  if (!Array.isArray(features)) return undefined;
  for (const f of features) {
    if (f && typeof f === 'object' && (f as { type?: unknown }).type === 'switchState') {
      const on = (f as { on?: unknown }).on;
      if (typeof on === 'boolean') return on;
      if (typeof on === 'string') return on === 'true';
    }
  }
  return undefined;
}
