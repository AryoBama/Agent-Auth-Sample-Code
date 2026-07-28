import { CAPABILITY_NAME } from "../shared/types.ts";

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
  },
  output: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      service: { type: "string" },
      channel: { type: "string" },
      textLength: { type: "number" }
    }
  }
} as const;
