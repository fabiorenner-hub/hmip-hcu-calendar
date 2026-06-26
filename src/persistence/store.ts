import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Config, defaultConfig, parseConfig } from '../shared/config.js';

/**
 * Persists the plugin configuration as JSON under the data directory using
 * atomic writes (write temp file, then rename). Reads are defensive: malformed
 * or missing data falls back to the seeded default configuration.
 */
export class ConfigStore {
  private readonly file: string;
  private cache: Config;

  constructor(private readonly dataDir: string) {
    this.file = join(dataDir, 'config.json');
    this.cache = this.load();
  }

  private load(): Config {
    try {
      const raw = readFileSync(this.file, 'utf8');
      return parseConfig(JSON.parse(raw));
    } catch {
      // First run or corrupt file: seed defaults (not persisted until a write).
      return defaultConfig();
    }
  }

  get(): Config {
    return this.cache;
  }

  /** Validate and atomically persist a new configuration. */
  save(next: unknown): Config {
    const parsed = parseConfig(next);
    try {
      mkdirSync(this.dataDir, { recursive: true });
    } catch {
      // Directory may already exist; ignore.
    }
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(parsed, null, 2), 'utf8');
    renameSync(tmp, this.file);
    this.cache = parsed;
    return parsed;
  }
}
