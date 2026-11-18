# Calibrex Remote MCP Gateway

## What this adds
- Remote, stateless MCP Streamable HTTP endpoint at `/api/mcp`.
- OAuth authorization-code flow with PKCE S256, public-client registration, CSRF-bound user consent, short-lived access tokens and rotating refresh tokens.
- User-scoped token records and revocation.
- Read tools: `calibrex_search_intelligence`, `calibrex_list_cases`, `calibrex_get_case`.
- Write tools: `calibrex_prepare_case_change` and `calibrex_confirm_case_change`. Prepare never mutates data; confirm is a separate tool invocation that succeeds only after the user approves the exact prepared change on a signed-in Calibrex browser page; the one-time approval expires after ten minutes and workspace permissions are rechecked.
- Shared workspace access is checked against current membership and role on each tool invocation. Viewer roles cannot write.
- Case updates preserve revision history and evidence-ledger append operations.

## Public endpoint
Default MCP URL: `https://app.calibrex.org/api/mcp`. The gateway is disabled unless `MCP_ENABLED=true` is set in the deployment environment.

Set `MCP_PUBLIC_URL` to the canonical HTTPS origin (for example `https://app.calibrex.org`) if the deployment host differs. No new AI provider key is required. Existing Calibrex session identity is used only during browser consent; MCP access uses separately scoped OAuth tokens.

OAuth metadata:
- `/.well-known/oauth-authorization-server` is served under `/api`.
- `/.well-known/oauth-protected-resource` is served under `/api`.

Because this application mounts the gateway under `/api`, the full metadata URLs are:
- `https://app.calibrex.org/api/.well-known/oauth-authorization-server`
- `https://app.calibrex.org/api/.well-known/oauth-protected-resource`

## Security notes and current boundaries
- Provider model inference is never proxied through Calibrex and no provider API keys are requested.
- Dynamic registration accepts only HTTPS redirect URIs, with loopback HTTP allowed for local development.
- Access tokens expire after 15 minutes; refresh tokens after 30 days and rotate on use.
- Tokens are opaque and stored as hashes; token lookup uses a hash index. Revocation deletes the token record.
- All MCP responses are marked no-store.
- Retrieved articles, social posts, URLs, case evidence and notes are untrusted data, not instructions.
- The initial tool set deliberately does not expose arbitrary database access, admin operations, user lists, billing, or settings.
- OAuth clients are public clients using PKCE; client secrets are not issued.
- The current implementation requires Calibrex browser login before consent. A user who is not signed in must first sign in to Calibrex in the same browser.
- ChatGPT provider-side availability is plan and workspace dependent; the MCP server exposes read and write tools, but clients may suppress write tools where their plan does not allow them.
- Production launch still requires dependency installation, automated tests, a live OAuth handshake against each provider, security review, and deployment verification. Do not create a separate MCP DNS record unless intentionally configuring `MCP_PUBLIC_URL`.

## Suggested provider setup
Use the full endpoint `https://app.calibrex.org/api/mcp` as the custom remote MCP server URL. Provider setup screens vary and may require a provider-side OAuth client registration choice. Prefer the provider's published OAuth identity or automatic registration when offered; use a custom OAuth client only if that provider requires one.

## Operational rollout gates
1. Install dependencies and run build/typecheck/tests. Keep `MCP_ENABLED` unset until the security and interoperability gates below pass.
2. Validate OAuth discovery, dynamic registration, PKCE, consent, token refresh and revocation.
3. Test read-only access, personal cases, workspace viewer/analyst/admin permissions, write confirmation, ledger integrity and cross-user denial.
4. Test Claude, Gemini and ChatGPT separately; provider feature availability is not uniform.
5. Deploy to Render and verify health plus live provider handshakes before announcing availability.
