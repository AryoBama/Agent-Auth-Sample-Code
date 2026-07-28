# Demo

This folder contains the end-to-end runner for the sample.

The demo starts the local service provider, creates a host-platform client, connects an agent, executes several capability calls, prints the result, and shuts the service provider down.

## Main File

```text
runDemo.ts
```

## Flow

The demo starts the service provider:

```ts
const serviceProvider = await startServiceProvider(SERVICE_PROVIDER_PORT);
```

Then it creates the host-platform client and connects the agent:

```ts
const hostPlatform = new HostPlatformAgentClient(serviceProvider.baseUrl);
await hostPlatform.connectAgent();
```

Then it runs five scenarios:

- allowed request to `#support`
- denied request to `#finance`
- denied request with message length over `300`
- denied replayed JWT
- denied execution after agent revocation

## Run

From the repository root:

```bash
npm run demo
```

Expected output:

```text
ALLOWED: send_slack_message to #support
DENIED: channel finance is not allowed
DENIED: message exceeds max length
DENIED: replayed jti
DENIED: agent is revoked
Internal Slack action ran 2 authorized request(s).
```

## Why There Are Two Authorized Requests

The replay scenario first sends a valid request using a manually signed JWT. That first request is authorized. The demo then reuses the same JWT, and the service provider rejects it as a replay.
