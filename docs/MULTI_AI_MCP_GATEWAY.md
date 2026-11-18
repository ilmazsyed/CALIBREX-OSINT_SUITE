# Calibrex Multi-AI Gateway

## Product contract

Calibrex supports two distinct AI connection paths. Do not conflate consumer subscriptions with API credentials.

### Professional / industry path
Keep the existing direct API-key integrations for OpenAI, Anthropic, Google Gemini and OpenRouter. The customer owns provider billing and controls the key. Preserve encrypted-at-rest storage, model selection, provider validation, rate limits and all existing AI features.

### Individual / small-business path
Provide a remote MCP integration so a user can connect an eligible consumer AI assistant to their own Calibrex account. Calibrex is the evidence and case system of record; the external assistant is the reasoning interface. Calibrex must not proxy model inference or pay model usage.

Provider support is capability-gated:
- Claude: remote MCP connector; consumer plan availability and connector limits must be checked at connection time.
- ChatGPT: remote MCP; plan-dependent read/fetch versus write capabilities.
- Gemini: remote MCP only where the user's account, region and product surface support custom apps.

Never promise that a consumer subscription grants API access. Never collect provider passwords, session cookies, bearer tokens or API keys through the MCP connection flow.

## MCP security and implementation requirements

1. Implement MCP Streamable HTTP at a stable HTTPS endpoint, with OAuth 2.1 authorization code + PKCE and protected-resource metadata.
2. Authenticate every MCP request to a Calibrex user identity. OAuth tokens must be opaque or signed, short-lived, audience-bound, revocable, and scoped to that user's account.
3. Use a browser-based Calibrex consent screen. Show the requesting AI client, requested scopes, account/workspace and whether write actions are requested.
4. Default to read-only scopes. Separate cases:read, evidence:read, briefs:read, cases:write, briefs:write, workspaces:write. Do not silently grant writes.
5. Enforce existing workspace membership/role checks for every tool. Never trust a workspace ID supplied by the model without checking membership and action permissions.
6. Every write tool must require explicit user confirmation at the client/tool level and create an audit record. Preserve investigation revisions and evidence-ledger semantics.
7. Treat all source content and case notes as untrusted prompt-injection material. Tool descriptions and server-side prompts must state that evidence is data, never instructions.
8. Apply per-user and per-token rate limits, request size limits, audit logging, token revocation, and Cache-Control: no-store.
9. Never proxy external model inference through Calibrex credentials. MCP only exposes Calibrex data and actions; the AI provider handles inference under the user's own entitlement.
10. Keep the current API-key route intact for professional/industry users. Do not remove Claude publishing, existing AI features, or OpenRouter.

## Initial tool surface

Read-only:
- calibrex_search_intelligence: search the current public-source intelligence feed and return bounded records with source URLs, timestamps and provenance.
- calibrex_list_cases: list only cases visible to the authenticated user in the selected personal/workspace scope.
- calibrex_get_case: return one permitted case, its evidence, notes, revision and evidence-ledger verification status.
- calibrex_get_workspace: return workspace metadata only if the user is a member.

Write (separately scoped and confirmation-gated):
- calibrex_create_case
- calibrex_update_case
- calibrex_save_brief
- calibrex_create_workspace

Do not expose arbitrary database access, raw store keys, admin endpoints, unrestricted feed controls, or cross-user search.

## Persistence model

All saved outputs must be written to the existing Calibrex personal or workspace investigation records, not to a separate MCP-only database. Record AI client/provider, actor user ID, timestamp, scope, action, and source/evidence references in the audit trail. Store the assistant's output as an analyst draft until the user approves it.

## Rollout gates

- Phase 1: protocol, OAuth, protected-resource metadata, read-only tools, consent, revocation, tests.
- Phase 2: confirmation-gated case/brief writes and audit.
- Phase 3: provider-specific setup guides and availability detection, including India eligibility for Gemini.
- Phase 4: production security review, load tests, deployment and end-to-end tests with actual Claude, ChatGPT and Gemini clients.

## Configuration boundary

The MCP service must not require OpenAI, Anthropic or Gemini model API keys. It may require Calibrex's own OAuth signing/encryption secrets and a canonical public HTTPS URL. Those are Calibrex application credentials, not user AI API keys. If these server-side OAuth settings are absent, MCP must remain disabled and the existing app/API-key experience must continue working.


## Implementation status — gateway scaffold

The implementation branch adds `server/mcp.js` and wires it into the existing Express server. The initial endpoint is `https://app.calibrex.org/mcp`; it deliberately uses the existing app domain, so no DNS change is needed.

Implemented in this branch:
- Streamable-HTTP-style JSON-RPC endpoint with `initialize`, `ping`, `tools/list`, and `tools/call`.
- OAuth protected-resource and authorization-server metadata.
- Dynamic public-client registration, authorization-code flow, S256 PKCE, opaque random access tokens, hashed token lookup, expiry and revocation.
- Browser consent bound to the signed-in Calibrex account.
- Personal and workspace case read/write callbacks using existing validation, workspace roles, revision history and evidence-ledger routines.
- Brief saving in the existing per-user `briefs` record.
- Explicit confirmation arguments for write tools; without `confirm: true`, the tool returns a confirmation request and does not mutate data.
- MCP disabled by default through `MCP_ENABLED=false` in `render.yaml`.

Important release limitations:
- This is a protocol implementation scaffold, not yet a provider-certified integration. ChatGPT, Claude and Gemini client compatibility, OAuth registration quirks, streaming/SSE expectations, and plan/region availability must be tested with real client accounts before marketing availability.
- The endpoint currently returns JSON-RPC responses over HTTP POST; it does not yet implement server-initiated SSE notifications or long-lived MCP sessions.
- Provider-specific setup guides and user-facing connection UI remain to be completed.
- Run the repository typecheck, build and test suite, then perform security review and real-client end-to-end tests before enabling `MCP_ENABLED=true`.
- The OAuth gateway does not use `MCP_OAUTH_SECRET`; high-entropy one-time codes and opaque tokens are stored only as hashed lookup keys. `PUBLIC_URL` and the explicit `MCP_ENABLED=true` switch are required.
