# Shared

This folder contains small shared constants and types used by both the host platform and the service provider.

## Main File

```text
types.ts
```

## Capability Name

The sample uses a single shared capability name:

```ts
export const CAPABILITY_NAME = "send_slack_message";
```

Using one shared constant prevents the host and provider from accidentally using different capability names.

## Shared Input Type

The host sends this input shape when executing the capability:

```ts
export type SlackMessageArgs = {
  channel: string;
  message: string;
};
```

The provider receives the same shape in its `onExecute` handler.

## Shared Decision Type

The demo normalizes SDK responses into a simple decision object:

```ts
export type DecisionResponse =
  | {
      allowed: true;
      message: string;
      result: unknown;
    }
  | {
      allowed: false;
      reason: string;
    };
```

This type is for readable demo output only. It is not part of the Agent Auth Protocol itself.
