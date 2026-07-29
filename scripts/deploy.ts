#!/usr/bin/env tsx

console.error([
  'Manual production deployment is disabled for domain-email.',
  'Production migrations and Worker deployment are owned exclusively by .github/workflows/ci-deploy.yml.',
  'For local development run: npm run dev:migrate && npm run dev',
].join('\n'));
process.exit(2);
