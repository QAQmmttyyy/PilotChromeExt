import { Hono } from 'hono';
import type { UIMessage } from 'ai';
import { streamAgentResponse } from '../agent';

const chatRoutes = new Hono();

interface ChatRequest {
  messages: UIMessage[];
  conversationId?: string;
}

chatRoutes.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { messages } = body;

  if (!messages || messages.length === 0) {
    return c.json({ error: 'Messages are required' }, 400);
  }

  try {
    const result = await streamAgentResponse(messages);
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export { chatRoutes };
