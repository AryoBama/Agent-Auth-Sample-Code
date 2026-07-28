# Agent Auth Protocol SDK Sample Code Instructions

## Context

This folder is for small sample code that demonstrates the core mechanism of the Agent Auth Protocol using the official TypeScript SDKs where available.

The goal is not to call a real third-party API. The goal is to show the expected Agent Auth Protocol usage described by the documentation: a host platform discovers a service provider, connects/registers an agent, receives a scoped capability grant, executes a capability, and the service provider verifies the request before running the allowed action.

This sample should model the case where the service provider itself supports Agent Auth Protocol. For example, imagine Slack exposes its own Agent Auth gateway. In that model there is no adapter layer owned by us. The service provider owns both the Agent Auth gateway and the actual capability implementation.

Important: do not implement protocol steps manually when the official SDK already provides them. Use the highest-level official SDK/API available first:

- client side: `@auth/agent`, especially `AgentAuthClient()`
- server side: `@better-auth/agent-auth`, or the official server implementation documented by Agent Auth Protocol

Manual implementation is allowed only for parts not provided by the SDKs, for the service provider's fake internal Slack behavior, or when an SDK/API is unavailable or blocked and the reason is documented.

## References to Read First

Read these references before coding:

1. Introduction  
   https://agentauthprotocol.com/docs/introduction

2. Client  
   https://agentauthprotocol.com/docs/client

3. Server  
   https://agentauthprotocol.com/docs/servers

4. Authentication  
   https://agentauthprotocol.com/docs/authentication

5. Capabilities  
   https://agentauthprotocol.com/docs/capabilities

6. Approval Methods  
   https://agentauthprotocol.com/docs/approval

7. Specification v1.0-draft  
   https://agentauthprotocol.com/specification/v1.0-draft

## Sample Code Objective

Build a minimal local host-platform/service-provider demo for this flow:

1. A local service provider is created using the official server-side Agent Auth package where possible.
2. The service provider exposes Agent Auth discovery, registration/connection, capability, execution, and lifecycle behavior.
3. The host platform uses `AgentAuthClient()` to discover the local service provider.
4. The host platform uses `AgentAuthClient()` to connect/register an agent.
5. The service provider grants one capability to the agent: `send_slack_message`.
6. The grant includes constraints:
   - allowed channel: `support`
   - maximum message length: `300`
7. The host platform uses `AgentAuthClient()` to execute the capability.
8. The SDK handles Agent JWT creation/signing for capability execution.
9. The service provider's Agent Auth implementation verifies the request before execution.
10. If all checks pass, the service provider runs its internal fake Slack action.
11. If any check fails, the service provider returns a clear deny reason.

The local service provider should appear as a small native Agent Auth provider built using official server-side support where possible. It does not need to implement production persistence, real OAuth, or real approval UX.

Do not build a separate adapter layer. In this sample, Slack-like behavior belongs inside the service provider, because the scenario assumes Slack is the party that provides the Agent Auth gateway.

## Server-Side SDK Requirements

The server side should use official Agent Auth server support where available. Start by attempting the documented server package:

```ts
import { agentAuth } from "@better-auth/agent-auth";
```

Use the current docs and installed package types as the source of truth for the exact API shape. If `@better-auth/agent-auth` has changed, inspect its package docs/types and adapt.

The service provider should define one capability: `send_slack_message`.

The capability should enforce these constraints:

- allowed channel: `support`
- maximum message length: `300`

The capability handler should run the fake Slack message action only after Agent Auth server-side checks pass.

If the official server package provides built-in handlers for discovery, registration, grants, execution, revocation, replay protection, or JWT verification, use those built-in handlers instead of manually recreating them.

Manual server code is acceptable only for:

- wiring a tiny local HTTP app if required by the server package
- defining the `send_slack_message` capability
- implementing fake internal Slack message behavior inside the service provider
- adding extra demo-only scenarios not supported by high-level SDK calls
- unavoidable gaps in the current server SDK, documented in README

The fake Slack behavior may be an in-process function or module under `service-provider/`. It should not be modeled as a separate adapter layer owned by the host platform.

The important boundary is:

```text
Host Platform with AgentAuthClient -> Service Provider with Official Agent Auth Server
```

## Client SDK / Protocol Flow Requirements

The preferred approach is to use the official client SDK in the way intended by the docs. Use `AgentAuthClient()` for the main client flow:

```ts
import { AgentAuthClient } from "@auth/agent";

const client = new AgentAuthClient();

const provider = await client.discoverProvider("http://127.0.0.1:3000");

const agent = await client.connectAgent({
  provider: provider.issuer,
  name: "Support Demo Agent",
  capabilities: [
    {
      name: "send_slack_message",
      constraints: {
        channel: { in: ["support"] },
        message: { maxLength: 300 }
      }
    }
  ]
});

const result = await client.executeCapability({
  agentId: agent.agentId,
  capability: "send_slack_message",
  arguments: {
    channel: "support",
    message: "Hello from the agent"
  }
});
```

The exact request and response shape should follow the installed SDK and current docs. If the SDK type definitions differ from the example above, inspect `node_modules/@auth/agent/dist/index.d.ts` and adapt to the actual exported API.

Do not use lower-level SDK helpers in the main path when `AgentAuthClient()` can perform the operation. Lower-level helpers may be used only if the high-level SDK does not expose the needed operation or cannot work with the local dummy provider after reasonable effort:

```ts
import { generateKeypair, signHostJWT, signAgentJWT } from "@auth/agent";
```

If lower-level helpers are used, the sample must still follow the expected protocol shape:

- provider discovery through a local discovery document
- agent registration/connection
- capability listing/granting
- short-lived Agent JWT for execution
- server-side Agent JWT verification
- capability and constraint enforcement
- lifecycle operations such as revocation

Using only `generateKeypair()` and `signAgentJWT()` without discovery, registration, capability listing/granting, and lifecycle is not enough.

The server-side implementation must verify the resulting Agent JWT. Prefer the official server package for this verification. Expected protocol-shaped fields include:

- JWT header:
  - `alg`: `EdDSA`
  - `typ`: `agent+jwt`
- JWT payload:
  - `sub`: agent ID
  - `aud`: provider issuer or expected audience from the SDK flow
  - `iat`: issued-at timestamp
  - `exp`: short expiration, ideally <= 60 seconds
  - `jti`: unique token ID
  - `capabilities`: optional list containing `send_slack_message`

The sample may simplify user approval. If the SDK requires approval fields, return an immediately active registration for default capabilities, and clearly document that real device authorization or CIBA is not implemented.

Server-side verification should not be manually recreated if the official server package provides it. If manual verification remains necessary because the server package does not expose the needed local sample behavior, explain that in README.

## When to Use `AgentAuthClient()`

`AgentAuthClient()` is the official high-level client abstraction described by the SDK docs. It is responsible for the protocol-facing workflow:

- provider discovery
- host identity storage
- agent connection/registration
- capability request and escalation
- capability execution
- Agent JWT signing internally
- agent status and lifecycle operations

Using only `generateKeypair()` and `signAgentJWT()` demonstrates the cryptographic mechanism, but it can bypass the intended protocol flow if the rest of the flow is missing. That is useful for a minimal simulator, but it may not answer the question: "How is Agent Auth Protocol expected to be used?"

Therefore:

- use `AgentAuthClient()` for discovery, connect/register, execute capability, status, disconnect/reactivate, and capability request flows when available
- use lower-level SDK helpers only for operations not covered by `AgentAuthClient()` or for unavoidable local-server compatibility issues
- if any protocol step is implemented manually, explain clearly in the README why SDK support was not used for that step
- if `AgentAuthClient()` is not used for the main flow, explain clearly what blocked it and how the sample still matches the expected protocol usage

## Required Server-Side Checks

The server must verify these checks, preferably through the official server package:

- JWT signature
- JWT header `typ` is `agent+jwt`
- agent exists
- agent status is `active`
- token is not expired
- token audience matches the provider issuer or expected SDK audience
- `jti` has not been reused
- requested capability is granted to the agent
- if the JWT has a `capabilities` claim, the requested capability is included
- request arguments satisfy the grant constraints

## Required Demo Scenarios

Running the demo must show these scenarios:

1. Allowed request  
   - channel: `support`
   - message length <= 300
   - expected result: allowed

2. Denied request due to wrong channel  
   - channel: `finance`
   - expected result: denied

3. Denied request due to too-long message  
   - message length > 300
   - expected result: denied

4. Denied request due to replayed JWT  
   - reuse the same `jti`
   - expected result: denied

5. Denied request due to revoked agent  
   - revoke the agent before execution
   - expected result: denied

## Suggested Architecture

Use this conceptual architecture:

```text
Agent -> Host Platform with AgentAuthClient SDK -> Service Provider with Official Agent Auth Server -> Internal Slack Capability
```

Responsibilities:

- `Agent`: runtime actor with its own identity.
- `Host Platform`: represents the application/runtime that hosts the agent. It uses `AgentAuthClient()` for discovery, agent connection/registration, capability execution, and lifecycle calls where available.
- `Service Provider`: represents a third-party service that natively supports Agent Auth Protocol. It uses official server-side Agent Auth support where available, defines `send_slack_message`, verifies identity/lifecycle/grants/replay protection, enforces constraints, and runs the internal Slack-like action.
- `Demo`: starts the local host/service-provider scenario and prints allowed/denied outcomes.

Keep authorization checks inside the Agent Auth server implementation. The fake Slack action should run only after the service provider authorizes the capability execution.

## Suggested Implementation

Required language: TypeScript, because this sample should use the official TypeScript SDK/packages.

Use Node.js 22 or newer.

Required dependency:

```text
@auth/agent
@better-auth/agent-auth
```

Do not stop at a JWT-only simulator. Do not manually recreate client-side or server-side protocol behavior that the official packages already provide.

Suggested folder structure:

```text
agent_auth_poc/
  INSTRUCTION.md
  README.md
  package.json
  tsconfig.json
  src/
    host-platform/
      agentAuthClient.ts
    service-provider/
      server.ts
      capabilities.ts
      slackService.ts
    demo/
      runDemo.ts
    shared/
      types.ts
```

## README Requirements

The README must explain:

1. What the sample demonstrates.
2. Which parts of Agent Auth Protocol are simulated.
3. Which parts are intentionally not implemented.
4. How to run the sample.
5. The local host-platform/service-provider architecture.
6. The service provider's Agent Auth endpoints and fake Slack capability behavior.
7. Expected output for each scenario.
8. Which parts use the official `@auth/agent` SDK.
9. Which parts use the official `@better-auth/agent-auth` server package.
10. Which client-side steps use `AgentAuthClient()`.
11. Which server-side steps are handled by the official server package.
12. Which steps, if any, are implemented manually and why SDK/server support was not used there.
13. How the sample follows the expected Agent Auth Protocol flow.
14. That this sample assumes the service provider natively supports Agent Auth Protocol, so no host-owned adapter layer is included.

## Non-Goals

Do not implement:

- real Slack API calls
- real user approval flow
- real OAuth integration
- production database storage
- real secrets or third-party credentials
- host-owned adapter layer for third-party services that do not support Agent Auth Protocol

This is sample code for the mechanism, not a production integration.

## Acceptance Criteria

The sample is complete when:

- one command runs the full demo, including starting the local server if needed
- all required scenarios are printed clearly
- allowed and denied decisions are easy to inspect
- the client uses `AgentAuthClient()` for every supported high-level client operation
- the server uses official Agent Auth server-side support where available
- any manual protocol implementation is limited to unsupported SDK/server gaps or fake internal service-provider behavior
- README clearly explains any manual step and why it was necessary
- the fake Slack action runs only after Agent Auth authorizes it
- no real third-party service is called
- no real secret is required
- README explains the result well enough for a report/demo

Expected output style:

```text
ALLOWED: send_slack_message to #support
DENIED: channel finance is not allowed
DENIED: message exceeds max length
DENIED: replayed jti
DENIED: agent is revoked
```
