# Connect an AI assistant to Calibrex OSINT Studio

## Endpoint

`https://app.calibrex.org/mcp`

The endpoint is enabled only when the Calibrex deployment has `MCP_ENABLED=true`. No separate MCP subdomain or DNS record is required.

## User connection

1. Sign in to your Calibrex account in a browser.
2. In an MCP-capable assistant, add a remote/custom MCP server using the endpoint above.
3. The assistant discovers Calibrex OAuth metadata and registers as a public OAuth client.
4. Complete the browser redirect to Calibrex and review the requested scopes.
5. Approve only the scopes you need. The access token is tied to your Calibrex account and can be revoked by the OAuth client.

No OpenAI, Anthropic, Google, OpenRouter API key, provider password, cookie or bearer token is entered into Calibrex. The assistant provider performs inference under the user's own account/entitlement. Provider plan, region, product-surface and connector support vary; the endpoint does not override those restrictions.

## Available tools in this initial gateway

- `calibrex_search_intelligence`: bounded search of the current public-source feed.
- `calibrex_get_workspaces`: workspaces where the signed-in user is a member.
- `calibrex_list_cases` / `calibrex_get_case`: personal or permitted workspace investigations.
- `calibrex_list_briefs`: saved personal briefs.
- `calibrex_create_case` / `calibrex_update_case`: write actions, requiring a separate `confirm: true` call after the assistant has shown the exact action to the user.
- `calibrex_save_brief`: saves a personal analyst brief, requiring explicit confirmation.

Workspace case operations enforce current Calibrex membership and role permissions. Case updates use the existing investigation validator, revision history and evidence ledger. Briefs are personal records in the existing briefs store.

## Provider compatibility

This is a standards-based remote MCP endpoint, not a provider certification. ChatGPT, Claude and Gemini availability depends on the provider's current supported plans, region and client surface. Test each provider/client combination with an eligible account before making it generally available. The current gateway responds with JSON-RPC over HTTP POST; server-initiated SSE notifications and long-lived sessions are not implemented yet.

## Deployment checklist for the Calibrex operator

- Merge the implementation after review and CI.
- In Render, set `MCP_ENABLED=true`; keep `PUBLIC_URL=https://app.calibrex.org`.
- Deploy and verify:
  - `/.well-known/oauth-protected-resource/mcp`
  - `/.well-known/oauth-authorization-server`
  - `/mcp` responds with HTTP 401 and OAuth resource metadata when no bearer token is supplied.
- Test consent, PKCE exchange, expiry, revocation, cross-user isolation, workspace viewer/analyst/admin permissions and confirmed writes.
- Connect real ChatGPT, Claude and Gemini clients where available. Do not advertise provider support until these tests pass.

The existing Calibrex AI API-key and OpenRouter connection features remain separate and unchanged.
