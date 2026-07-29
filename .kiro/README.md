# Kiro CLI configuration for domain-email

This workspace provides a project-specific agent, steering instructions, and an on-demand Cloudflare operations skill.

## Files

- `agents/cloudflare-domain-email.json` — project agent and tool-safety policy.
- `steering/domain-email.md` — architecture, coding, validation, and production-operation rules loaded as workspace context.
- `skills/domain-email-cloudflare/SKILL.md` — progressively loaded Cloudflare development/operations workflow.
- `settings/cli.json` — makes the project agent the default for new sessions in this repository.

The five Cloudflare MCP servers are attached to the custom agent by referencing the same remote endpoints already configured globally. This does **not** install another MCP implementation or store OAuth credentials in the repository. No workspace `.kiro/settings/mcp.json` is created, and the existing global configuration remains unchanged.

## Use

Start a new session from the repository root:

```bash
kiro-cli chat
```

Or select the agent explicitly:

```bash
kiro-cli chat --agent cloudflare-domain-email
```

Inside an existing session, use `/agent` to switch agents. Restart the session after changing agent, steering, skill, or MCP configuration.

## Verify

```bash
kiro-cli agent validate --path .kiro/agents/cloudflare-domain-email.json
kiro-cli agent list
kiro-cli mcp list
```

Expected MCP server names are `cloudflare`, `cloudflare-docs`, `cloudflare-bindings`, `cloudflare-builds`, and `cloudflare-observability`.

Production mutations are intentionally not auto-approved. Read-only documentation, build, and observability tools are auto-approved; resource changes, API mutations, remote migrations, and deployments still require confirmation.
