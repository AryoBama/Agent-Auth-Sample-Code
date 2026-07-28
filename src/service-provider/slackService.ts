import type { SlackMessageArgs } from "../shared/types.ts";

export type InternalSlackMessage = {
  channel: string;
  message: string;
};

export class InternalSlackService {
  readonly sentMessages: InternalSlackMessage[] = [];

  sendMessage(args: SlackMessageArgs): {
    ok: true;
    service: "internal-fake-slack";
    channel: string;
    textLength: number;
  } {
    this.sentMessages.push({
      channel: args.channel,
      message: args.message
    });

    return {
      ok: true,
      service: "internal-fake-slack",
      channel: `#${args.channel}`,
      textLength: args.message.length
    };
  }
}
