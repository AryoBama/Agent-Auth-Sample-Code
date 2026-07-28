# Service Provider

This folder represents a third-party service that natively supports Agent Auth Protocol.

In this sample, the service provider behaves like Slack exposing its own Agent Auth gateway. There is no host-owned adapter layer. The provider owns both the Agent Auth server behavior and the internal `send_slack_message` capability.

## Responsibility

The service provider is responsible for:

- exposing Agent Auth discovery
- exposing the capability list
- accepting agent registration
- granting capabilities
- verifying Agent JWTs
- checking agent lifecycle status
- blocking replayed JWT IDs
- enforcing capability constraints
- running the internal service action after authorization succeeds

## Files

```text
server.ts
```

Creates the local service provider using Better Auth and the Agent Auth plugin.

```text
capabilities.ts
```

Defines the `send_slack_message` capability and its input schema.

```text
slackService.ts
```

Implements the fake internal Slack-like action. This is not a separate external Slack API.

## Server Setup

The service provider uses the official server package:

```ts
import { agentAuth } from "@better-auth/agent-auth";
```

It is mounted as a Better Auth plugin:

```ts
plugins: [
  agentAuth({
    providerName: "Local Native Slack-like Provider",
    modes: ["autonomous"],
    approvalMethods: ["none"],
    allowDynamicHostRegistration: true,
    defaultHostCapabilities: [CAPABILITY_NAME],
    jtiCacheStorage: "memory",
    capabilities: [sendSlackMessageCapability],
    validateCapabilities: (capabilities) => {
      return capabilities.every((capability) => capability === CAPABILITY_NAME);
    },
    onExecute: async ({ capability, arguments: args }) => {
      // internal capability execution
    }
  })
]
```

## Capability Definition

The provider exposes one capability:

```ts
export const sendSlackMessageCapability = {
  name: CAPABILITY_NAME,
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

## Execution Gate

The internal Slack action runs only inside `onExecute`, after the Agent Auth server package validates the request:

```ts
onExecute: async ({ capability, arguments: args }) => {
  if (capability !== CAPABILITY_NAME) {
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

This models the service provider enforcing governance before executing the action.
