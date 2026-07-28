import { HostPlatformAgentClient } from "../host-platform/agentAuthClient.ts";
import { startServiceProvider } from "../service-provider/server.ts";
import type { DecisionResponse, SlackMessageArgs } from "../shared/types.ts";

const SERVICE_PROVIDER_PORT = 3000;

async function main(): Promise<void> {
  const serviceProvider = await startServiceProvider(SERVICE_PROVIDER_PORT);

  try {
    const hostPlatform = new HostPlatformAgentClient(serviceProvider.baseUrl);
    await hostPlatform.connectAgent();

    await runScenario("Allowed request", async () => {
      return hostPlatform.executeSlackMessage({
        channel: "support",
        message: "Customer needs help resetting a password."
      });
    });

    await runScenario("Denied request due to wrong channel", async () => {
      return hostPlatform.executeSlackMessage({
        channel: "finance",
        message: "Please review this invoice."
      });
    });

    await runScenario("Denied request due to too-long message", async () => {
      return hostPlatform.executeSlackMessage({
        channel: "support",
        message: "x".repeat(301)
      });
    });

    await runScenario("Denied request due to replayed JWT", async () => {
      const token = await hostPlatform.signCapabilityJwt();
      const args: SlackMessageArgs = {
        channel: "support",
        message: "First request with this JWT is allowed."
      };

      await hostPlatform.executeWithToken(token, args);
      return hostPlatform.executeWithToken(token, args);
    });

    await runScenario("Denied request due to revoked agent", async () => {
      const token = await hostPlatform.signCapabilityJwt();
      await hostPlatform.disconnectAgent();
      return hostPlatform.executeWithToken(token, {
        channel: "support",
        message: "This should not reach the internal Slack action."
      });
    });

    console.log(
      `Internal Slack action ran ${serviceProvider.slackService.sentMessages.length} authorized request(s).`
    );
  } finally {
    await serviceProvider.close();
  }
}

async function runScenario(
  _title: string,
  execute: () => Promise<DecisionResponse>
): Promise<void> {
  const decision = await execute();
  if (decision.allowed) {
    console.log(`ALLOWED: ${decision.message}`);
    return;
  }

  console.log(`DENIED: ${decision.reason}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
