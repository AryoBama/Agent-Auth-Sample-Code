import { AgentAuthClient, type ExecuteCapabilityResponse } from "@auth/agent";
import { CAPABILITY_NAME, type DecisionResponse, type SlackMessageArgs } from "../shared/types.ts";

export class HostPlatformAgentClient {
  private readonly sdk = new AgentAuthClient({
    allowDirectDiscovery: true,
    hostName: "Local Demo Host Platform",
    jwtExpirySeconds: 60
  });

  private agentId: string | undefined;
  private executeAudience: string | undefined;
  private readonly providerBaseUrl: string;

  constructor(providerBaseUrl: string) {
    this.providerBaseUrl = providerBaseUrl;
  }

  async connectAgent(): Promise<void> {
    const provider = await this.sdk.discoverProvider(this.providerBaseUrl);
    this.executeAudience = provider.default_location;

    await this.sdk.listCapabilities({
      provider: provider.issuer
    });

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

    this.agentId = agent.agentId;
  }

  async executeSlackMessage(args: SlackMessageArgs): Promise<DecisionResponse> {
    if (!this.agentId) {
      throw new Error("agent is not connected");
    }

    try {
      const response = await this.sdk.executeCapability({
        agentId: this.agentId,
        capability: CAPABILITY_NAME,
        arguments: args
      });

      return sdkResponseToDecision(response, args);
    } catch (error) {
      return {
        allowed: false,
        reason: normalizeDenyReason(
          error instanceof Error ? error.message : "capability execution failed",
          args
        )
      };
    }
  }

  async signCapabilityJwt(): Promise<string> {
    if (!this.agentId) {
      throw new Error("agent is not connected");
    }

    if (!this.executeAudience) {
      throw new Error("provider execute audience is not available");
    }

    const signed = await this.sdk.signJwt({
      agentId: this.agentId,
      capabilities: [CAPABILITY_NAME],
      audience: this.executeAudience
    });

    return signed.token;
  }

  async executeWithToken(token: string, args: SlackMessageArgs): Promise<DecisionResponse> {
    if (!this.executeAudience) {
      throw new Error("provider execute audience is not available");
    }

    const response = await fetch(this.executeAudience, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        capability: CAPABILITY_NAME,
        arguments: args
      })
    });

    const body = await response.json();
    if (!response.ok) {
      return {
        allowed: false,
        reason: normalizeDenyReason(body.message ?? body.reason ?? "capability execution failed", args)
      };
    }

    return {
      allowed: true,
      message: body.message ?? body.data?.message ?? `send_slack_message to #${args.channel}`,
      result: body.result ?? body.data?.result ?? body.data
    };
  }

  async disconnectAgent(): Promise<void> {
    if (!this.agentId) {
      throw new Error("agent is not connected");
    }

    await this.sdk.disconnectAgent(this.agentId);
  }
}

function normalizeDenyReason(reason: string, args: SlackMessageArgs): string {
  if (reason === "One or more capability constraints were violated" && args.channel !== "support") {
    return `channel ${args.channel} is not allowed`;
  }

  if (reason === "JWT has already been used") {
    return "replayed jti";
  }

  if (reason === "Agent has been revoked") {
    return "agent is revoked";
  }

  return reason;
}

function sdkResponseToDecision(
  response: ExecuteCapabilityResponse,
  args: SlackMessageArgs
): DecisionResponse {
  const body = response as ExecuteCapabilityResponse & {
    message?: string;
    result?: unknown;
    data?: {
      message?: string;
      result?: unknown;
    };
  };

  if (body.status === "failed") {
    return {
      allowed: false,
      reason: body.error?.message ?? "capability execution failed"
    };
  }

  return {
    allowed: true,
    message: body.message ?? body.data?.message ?? `send_slack_message to #${args.channel}`,
    result: body.result ?? body.data?.result ?? body.data
  };
}
