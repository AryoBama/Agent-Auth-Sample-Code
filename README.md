# Agent Auth Protocol Sample Code

This repository contains a small TypeScript sample that demonstrates how the Agent Auth Protocol can be used to govern an AI agent's access to a service capability.

The sample models a case where a Slack-like service provider already supports Agent Auth Protocol natively. This means the service provider owns the Agent Auth gateway and the capability implementation. The host platform only needs to use the Agent Auth client SDK to discover the provider, connect an agent, request a scoped capability, and execute that capability.

No real Slack API, OAuth flow, approval UI, production database, secrets, or third-party credentials are used.

## What Agent Auth Protocol Does

Agent Auth Protocol gives an AI agent a first-class identity when it accesses tools or services. Instead of letting an agent use a shared backend token, the protocol allows a service provider to know:

- which host platform is running the agent
- which agent is making the request
- which capability the agent is trying to use
- which constraints apply to that capability
- whether the agent is still active or has been revoked

In this sample, the agent can request one capability:

```text
send_slack_message
```

The service provider grants it with a limited scope:

```text
channel must be support
message length must be <= 300
```

That means the agent can send a message to `#support`, but the same agent is denied if it tries to send to `#finance`, sends an oversized message, reuses a JWT, or executes after revocation.

## Architecture

```text
Agent
  -> Host Platform with AgentAuthClient SDK
  -> Service Provider with Better Auth + Agent Auth Plugin
  -> Internal Slack Capability
```

The important model is:

```text
host-platform/
```

Represents the platform that runs the agent. In a real system, this could be an internal agent platform, AIP runtime, Codex wrapper, desktop app, or backend agent runner.

```text
service-provider/
```

Represents a third-party service that natively supports Agent Auth Protocol. In this sample, it behaves like Slack providing its own Agent Auth gateway and internal `send_slack_message` capability.

```text
demo/
```

Runs the end-to-end scenario locally.

```text
shared/
```

Contains shared constants and TypeScript types.

## Folder Guide

```text
src/
  host-platform/
    agentAuthClient.ts
    README.md

  service-provider/
    server.ts
    capabilities.ts
    slackService.ts
    README.md

  demo/
    runDemo.ts
    README.md

  shared/
    types.ts
    README.md
```

## Main Flow

The host platform discovers the service provider:

```ts
const provider = await this.sdk.discoverProvider(this.providerBaseUrl);
```

The host platform lists capabilities exposed by the provider:

```ts
await this.sdk.listCapabilities({
  provider: provider.issuer
});
```

The host platform connects/registers an agent and requests a constrained capability:

```ts
const agent = await this.sdk.connectAgent({
  provider: provider.issuer,
  name: "Support Demo Agent",
  mode: "autonomous",
  capabilities: [
    {
      name: "send_slack_message",
      constraints: {
        channel: { in: ["support"] }
      }
    }
  ]
});
```

The host platform executes the capability:

```ts
const response = await this.sdk.executeCapability({
  agentId: this.agentId,
  capability: "send_slack_message",
  arguments: {
    channel: "support",
    message: "Customer needs help resetting a password."
  }
});
```

The service provider defines the capability:

```ts
export const sendSlackMessageCapability = {
  name: "send_slack_message",
  description: "Send a message to the provider's internal support Slack channel.",
  approvalStrength: "none",
  input: {
    type: "object",
    properties: {
      channel: {
        type: "string",
        enum: ["support"]
      },
      message: {
        type: "string",
        maxLength: 300
      }
    },
    required: ["channel", "message"]
  }
} as const;
```

The service provider executes the internal Slack-like action only after Agent Auth checks pass:

```ts
onExecute: async ({ capability, arguments: args }) => {
  if (capability !== "send_slack_message") {
    throw new Error(`unsupported capability ${capability}`);
  }

  const slackArgs = args as SlackMessageArgs;
  if (slackArgs.message.length > 300) {
    throw agentError(
      "FORBIDDEN",
      AGENT_AUTH_ERROR_CODES.CONSTRAINT_VIOLATED,
      "message exceeds max length"
    );
  }

  return slackService.sendMessage(slackArgs);
}
```

## What Uses the Official SDK

Client-side package:

```ts
import { AgentAuthClient } from "@auth/agent";
```

Used for:

- provider discovery
- capability listing
- agent connection/registration
- capability execution
- Agent JWT signing
- agent disconnect/revoke

Server-side package:

```ts
import { agentAuth } from "@better-auth/agent-auth";
```

Used for:

- Agent Auth endpoint behavior
- agent registration
- capability list
- capability execution
- JWT verification
- replay protection
- lifecycle checks
- grant checks
- supported constraint checks

## What Is Manual

Some code is intentionally manual because this is a local sample:

- local Node HTTP server wiring
- in-memory demo database
- fake internal Slack behavior
- clean demo output
- adversarial demo calls for replayed JWT and revoked-agent execution
- manual `message.length <= 300` check because the installed server package supports numeric `max` constraints but not a string `maxLength` operator

## HTTP Endpoints

The local service provider runs on:

```text
http://127.0.0.1:3000
```

Relevant endpoints exposed by the Agent Auth server package:

```text
GET  /.well-known/agent-configuration
GET  /agent-configuration
GET  /capability/list
POST /agent/register
POST /capability/execute
POST /agent/revoke
```

There is no separate Slack HTTP endpoint. The Slack-like action is internal to the service provider.

## How to Run

Prerequisite:

```bash
node --version
```

Use Node.js `22` or newer. If Node.js is not installed, install it first from:

```text
https://nodejs.org/
```

Then run:

```bash
cd agent_auth_sample_code
npm install
npm run typecheck
npm run demo
```

If the folder is inside the GDP Labs workspace, the command may look like this:

```bash
cd "/home/bamane/Magang/GDP Labs/agent_auth_sample_code"
npm install
npm run typecheck
npm run demo
```

## Expected Output

```text
ALLOWED: send_slack_message to #support
DENIED: channel finance is not allowed
DENIED: message exceeds max length
DENIED: replayed jti
DENIED: agent is revoked
Internal Slack action ran 2 authorized request(s).
```

The internal Slack action count is `2` because the replay scenario first sends one valid request, then reuses the same JWT and gets denied on the second request.

## What This Sample Proves

This sample shows that Agent Auth Protocol can express technical governance for agent tool access:

- the agent has its own identity
- the provider exposes explicit capabilities
- the host requests limited capability scope
- the provider validates execution before running the action
- replayed execution tokens are rejected
- revoked agents cannot continue executing

The sample does not prove production readiness. It is only a focused sample for understanding the protocol flow.
