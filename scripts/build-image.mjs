import { createReadStream, createWriteStream, readFileSync, rmSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = pkg.version;
const name = pkg.name;
const tag = `${name}:${version}`;
const tarball = `${name}-${version}-arm64.tar.gz`;
const imageTar = `${name}-${version}-arm64.tar`;

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (res.status !== 0) {
    throw new Error(`${cmd} exited with ${res.status}`);
  }
}

// Build an arm64 image and export it as a docker image archive, then gzip it.
// This mirrors eq3's documented `docker build` + `docker save | gzip` flow,
// which is verified to install on the HCU (the official example installs from
// exactly this archive). Provenance/SBOM are disabled so the archive contains
// a single image manifest (no attestation entries).
run('docker', [
  'buildx',
  'build',
  '--platform',
  'linux/arm64',
  '--provenance=false',
  '--sbom=false',
  '--build-arg',
  `CALENDAR_VERSION=${version}`,
  '-t',
  tag,
  '--output',
  `type=docker,dest=${imageTar}`,
  '.',
]);

await pipeline(createReadStream(imageTar), createGzip(), createWriteStream(tarball));
rmSync(imageTar, { force: true });

console.log(`\nArtifact ready: ${tarball}`);
