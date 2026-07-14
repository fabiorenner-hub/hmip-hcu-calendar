import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** Atomically write a JSON value: write a temp file, then rename over the target. */
export async function atomicWriteJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}
