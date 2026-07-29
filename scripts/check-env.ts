#!/usr/bin/env tsx

/** Local-only preflight. It never lists or mutates remote Cloudflare resources. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const version = spawnSync('npx', ['wrangler', '--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (version.status !== 0) {
  console.error('Wrangler is unavailable. Run npm ci first.');
  process.exit(1);
}

try {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
  if (config.name !== 'domain-inbox') throw new Error('Worker name must be domain-inbox');
  if (!config.d1_databases?.some((entry: { binding?: string }) => entry.binding === 'INBOX_DB')) throw new Error('INBOX_DB binding missing');
  if (!config.r2_buckets?.some((entry: { binding?: string }) => entry.binding === 'INBOX_BUCKET')) throw new Error('INBOX_BUCKET binding missing');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid wrangler.jsonc');
  process.exit(1);
}

console.log(`Local environment ready (${version.stdout.trim()}). Bindings remain local unless explicitly configured otherwise.`);
