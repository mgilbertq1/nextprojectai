export interface GrokChatResponse {
  choices: Array<{
    message?: {
      content: string;
    };
    text?: string;
  }>;
}
