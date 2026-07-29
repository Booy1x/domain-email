# domain-email project steering

## Architecture

- Runtime: Cloudflare Worker using the module entrypoint `src/index.ts`.
- Email ingress: Cloudflare Email Routing invokes the Worker's `email` handler.
- HTTP UI/API: the same Worker serves the inbox and JSON/download endpoints.
- Metadata and search: D1 binding `INBOX_DB`; schema changes live in ordered files under `migrations/`.
- Raw messages and attachments: R2 binding `INBOX_BUCKET`.
- Public hostname: `mail.525458.xyz`, protected by Cloudflare Access outside this repository.
- Production deployment: GitHub Actions is the intended deployment owner. Cloudflare Git auto-deploy must remain disconnected once the Actions workflow is active.

## Development rules

1. Inspect existing code and configuration before changing behavior.
2. For current Cloudflare behavior, search `cloudflare-docs` first. Do not rely on memory for product limits, API schemas, Wrangler flags, or Access behavior.
3. Keep D1 migrations additive and backward-compatible with the currently deployed Worker. Never edit a migration that may already have run; add a new numbered migration.
4. Treat D1 and R2 as separate systems with no shared transaction. Design ingestion and deletion so partial failures are retryable and observable.
5. Use stable IDs for R2 keys. Sender-controlled filenames belong in metadata, not object paths.
6. Preserve the HTML email sandbox/CSP boundary. Treat email bodies, headers, filenames, MIME types, links, and remote images as attacker-controlled.
7. Do not log message bodies, attachment contents, tokens, Access assertions, or complete email addresses.
8. Keep API output raw and escape at the rendering boundary; avoid double HTML escaping.
9. Use keyset pagination with a deterministic tie-breaker such as `(received_at, id)`.
10. Avoid adding frameworks or dependencies unless they materially reduce risk or complexity; pin any new dependency to an exact version.

## Validation

For source/config changes, run the smallest relevant checks and normally finish with:

```bash
npm run type-check
npm test
npx wrangler deploy --dry-run
```

For migration changes, also test migrations against a disposable/local D1 database. Never use production D1 as a test target.

## Cloudflare MCP selection

- `cloudflare-docs`: product documentation and current recommended behavior.
- `cloudflare-bindings`: inspect or manage D1, R2, KV, Hyperdrive, and Worker bindings. Mutations require explicit user approval.
- `cloudflare-builds`: inspect Workers Builds and build logs.
- `cloudflare-observability`: inspect production logs/metrics. Discover keys and values before filtering; redact PII in summaries.
- `cloudflare`: use the Cloudflare API only after finding the correct endpoint/schema. Read before mutate, and verify after mutation.

## High-impact operations

Before production deploys, remote D1 migrations, route/Email Routing/Access changes, secret changes, database or bucket deletion, purge operations, or backup restoration:

1. Explain what will change, the failure mode, and rollback path.
2. Verify target account, Worker, database, bucket, zone, and environment.
3. Obtain explicit confirmation.
4. Perform the smallest scoped action.
5. Verify with API state, build output, logs, or a safe smoke test.

Never bypass Cloudflare Access to make testing easier. Never commit credentials, local backups, `.wrangler/`, or raw email data.
