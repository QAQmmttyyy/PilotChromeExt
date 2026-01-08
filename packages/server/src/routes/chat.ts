import { Hono } from 'hono';
import { generateId, type UIMessage } from 'ai';
import { eq, desc, asc } from 'drizzle-orm';
import { streamAgentResponse } from '../agent';
import { db, schema } from '../db';

const chatRoutes = new Hono();

interface ChatRequest {
  message: UIMessage;
  id?: string;
}

async function loadChat(conversationId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    parts: row.parts as UIMessage['parts'],
  }));
}

async function saveMessage(conversationId: string, message: UIMessage): Promise<void> {
  if (message.role !== 'user' && message.role !== 'assistant') return;
  
  await db
    .insert(schema.messages)
    .values({
      id: message.id,
      conversationId,
      role: message.role,
      parts: message.parts,
    })
    .onConflictDoUpdate({
      target: schema.messages.id,
      set: {
        parts: message.parts,
      },
    });
}

async function getOrCreateConversation(id: string, title?: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id));
  
  if (existing) return existing.id;

  const [conversation] = await db
    .insert(schema.conversations)
    .values({ id, title })
    .returning();
  
  return conversation.id;
}

async function updateConversationTitle(conversationId: string, message: UIMessage): Promise<void> {
  const textPart = message.parts.find((p: any) => p.type === 'text') as { type: 'text'; text: string } | undefined;
  if (textPart) {
    const title = textPart.text.slice(0, 100);
    await db
      .update(schema.conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversationId));
  }
}

chatRoutes.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { message, id: conversationId } = body;

  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }

  if (!conversationId) {
    return c.json({ error: 'Conversation ID is required' }, 400);
  }

  try {
    const chatId = await getOrCreateConversation(conversationId);
    
    const previousMessages = await loadChat(chatId);
    
    if (previousMessages.length === 0 && message.role === 'user') {
      await updateConversationTitle(chatId, message);
    }
    
    await saveMessage(chatId, message);
    
    const messages = [...previousMessages, message];
    
    const result = await streamAgentResponse(messages);

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onFinish: async ({ responseMessage }) => {
        if (responseMessage) {
          await saveMessage(chatId, responseMessage);
          await db
            .update(schema.conversations)
            .set({ updatedAt: new Date() })
            .where(eq(schema.conversations.id, chatId));
        }
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export { chatRoutes };
