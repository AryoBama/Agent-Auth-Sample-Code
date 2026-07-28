# Host Platform

This folder represents the side that runs the AI agent.

In Agent Auth Protocol terms, the host platform is the application or runtime that manages the agent and talks to a service provider using the client SDK. In a real system, this could be an internal agent platform, AIP runtime, Codex wrapper, backend worker, or desktop app.

## Responsibility

The host platform is responsible for:

- discovering the Agent Auth provider
- listing available capabilities
- connecting/registering the agent
- requesting scoped capabilities
- executing granted capabilities
- handling denied responses
- disconnecting or revoking the agent when needed

## Main Code

The main file is:

```text
agentAuthClient.ts
```

It wraps the official `AgentAuthClient` SDK:

```ts
private readonly sdk = new AgentAuthClient({
  allowDirectDiscovery: true,
  hostName: "Local Demo Host Platform",
  jwtExpirySeconds: 60
});
```

## Connection Flow

The host discovers the provider:

```ts
const provider = await this.sdk.discoverProvider(this.providerBaseUrl);
```

Then it requests a constrained capability:

```ts
const agent = await this.sdk.connectAgent({
  provider: provider.issuer,
  name: "Support Demo Agent",
  mode: "autonomous",
  capabilities: [
    {
      name: CAPABILITY_NAME,
      constraints: {
        channel: { in: ["support"] }
      }
    }
  ]
});
```

This means the agent is connected with limited access. It can request `send_slack_message`, but only for the `support` channel.

## Execution Flow

The host executes the capability through the SDK:

```ts
const response = await this.sdk.executeCapability({
  agentId: this.agentId,
  capability: CAPABILITY_NAME,
  arguments: args
});
```

The host does not directly call Slack. The request goes to the service provider, and the service provider decides whether the capability execution is allowed.

## Demo-Only Code

The methods `signCapabilityJwt()` and `executeWithToken()` are used only to demonstrate adversarial cases:

- replaying the same JWT
- trying to execute after the agent is revoked

The normal path should use `executeCapability()`.
