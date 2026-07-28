export const CAPABILITY_NAME = "send_slack_message";

export type SlackMessageArgs = {
  channel: string;
  message: string;
};

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
