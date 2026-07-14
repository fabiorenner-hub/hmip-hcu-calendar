// Build an OTA payload bundle (+ manifest + sha256) for the stable or
// experimental channel. Usage: node scripts/build-ota.mjs <stable|experimental>
//
// Output (under dist/ota-dist/): the JSON bundle file (main.js + public/* as
// base64), an ota-manifest[-exp].json and a <bundle>.sha256. The image is never
// touched. Experimental NEVER bumps the version (uses X.Y.Z+exp.<utc-stamp>).
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const channel = process.argv[2] === 'experimental' ? 'experimental' : 'stable';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const baseVersion = pkg.version;
const repo = 'fabiorenner-hub/hmip-hcu-calendar';
const minCoreVersion = process.env.CALENDAR_MIN_CORE ?? '0.1.0';
const BUNDLE_FORMAT = 'calendar-ota-1';

function utcStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(
    d.getUTCMinutes(),
  )}${p(d.getUTCSeconds())}`;
}

const version = channel === 'experimental' ? `${baseVersion}+exp.${utcStamp()}` : baseVersion;
const tag = channel === 'experimental' ? 'experimental' : `v${baseVersion}`;
const suffix = channel === 'experimental' ? '-exp' : `-${baseVersion}`;
const bundleName = `calendar-ota${suffix}.json`;
const manifestName = channel === 'experimental' ? 'ota-manifest-exp.json' : 'ota-manifest.json';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const outDir = join(root, 'dist', 'ota-dist');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1) Bundle src/plugin/index.ts into a single self-contained main.js.
const mainOut = join(root, 'dist', 'ota', 'main.js');
mkdirSync(join(root, 'dist', 'ota'), { recursive: true });
await build({
  entryPoints: [join(root, 'src', 'plugin', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: mainOut,
  banner: {
    js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

// 2) Collect files: main.js + everything under public/ (except source maps).
const files = {};
files['main.js'] = readFileSync(mainOut).toString('base64');
const publicRoot = join(root, 'public');
function walk(dir, rel) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    if (statSync(abs).isDirectory()) walk(abs, relPath);
    else if (!relPath.endsWith('.map')) files[`public/${relPath}`] = readFileSync(abs).toString('base64');
  }
}
walk(publicRoot, '');

// 3) Write the bundle file + sha256 + manifest.
const bundleObj = { format: BUNDLE_FORMAT, version, files };
const bundleBytes = Buffer.from(JSON.stringify(bundleObj), 'utf8');
writeFileSync(join(outDir, bundleName), bundleBytes);
const sha256 = createHash('sha256').update(bundleBytes).digest('hex');
writeFileSync(join(outDir, `${bundleName}.sha256`), `${sha256}  ${bundleName}\n`);

const manifest = {
  version,
  minCoreVersion,
  sha256,
  assetUrl: `https://github.com/${repo}/releases/download/${tag}/${bundleName}`,
  bundleName,
  notes: `${channel} OTA build`,
};
writeFileSync(join(outDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`OTA ${channel} built: ${bundleName} (${(bundleBytes.length / 1024).toFixed(0)} KB)`);
console.log(`  version=${version} tag=${tag} sha256=${sha256.slice(0, 12)}…`);
console.log(`  files: ${Object.keys(files).length}  out: dist/ota-dist/`);
