import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AGENT_AUTH_ERROR_CODES, agentAuth, agentError } from "@better-auth/agent-auth";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { CAPABILITY_NAME, type SlackMessageArgs } from "../shared/types.ts";
import { sendSlackMessageCapability } from "./capabilities.ts";
import { InternalSlackService } from "./slackService.ts";

export type ServiceProviderHandle = {
  server: Server;
  baseUrl: string;
  slackService: InternalSlackService;
  close: () => Promise<void>;
};

export async function startServiceProvider(port: number): Promise<ServiceProviderHandle> {
  const baseUrl = `http://127.0.0.1:${port}`;
  const slackService = new InternalSlackService();
  const db = {
    user: [],
    session: [],
    account: [],
    verification: [],
    agentHost: [],
    agent: [],
    agentCapabilityGrant: [],
    approvalRequest: []
  };

  const auth = betterAuth({
    baseURL: baseUrl,
    basePath: "/",
    database: memoryAdapter(db),
    trustedOrigins: [baseUrl],
    plugins: [
      agentAuth({
        providerName: "Local Native Slack-like Provider",
        providerDescription:
          "Local service provider that natively supports Agent Auth and implements a fake Slack capability internally.",
        modes: ["autonomous"],
        approvalMethods: ["none"],
        allowDynamicHostRegistration: true,
        defaultHostCapabilities: [CAPABILITY_NAME],
        resolveAutonomousUser: () => ({
          id: "user_demo",
          name: "Demo User",
          email: "demo@example.test"
        }),
        jtiCacheStorage: "memory",
        capabilities: [sendSlackMessageCapability],
        validateCapabilities: (capabilities) => {
          return capabilities.every((capability) => capability === CAPABILITY_NAME);
        },
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
      })
    ]
  });

  const server = createServer(async (request, response) => {
    try {
      const authRequest = toWebRequest(request, baseUrl);
      const authResponse =
        request.method === "GET" && request.url === "/.well-known/agent-configuration"
          ? await auth.handler(new Request(`${baseUrl}/agent-configuration`, authRequest))
          : await auth.handler(authRequest);

      await writeWebResponse(response, authResponse);
    } catch (error) {
      writeJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : "internal server error"
      });
    }
  });

  await listen(server, port);

  return {
    server,
    baseUrl,
    slackService,
    close: () => close(server)
  };
}

function toWebRequest(request: IncomingMessage, baseUrl: string): Request {
  const url = new URL(request.url ?? "/", baseUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return new Request(url, {
      method: request.method,
      headers
    });
  }

  return new Request(url, {
    method: request.method,
    headers,
    body: request as unknown as BodyInit,
    duplex: "half"
  } as RequestInit);
}

async function writeWebResponse(response: ServerResponse, webResponse: Response): Promise<void> {
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));

  if (!webResponse.body) {
    response.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  response.end(body);
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
