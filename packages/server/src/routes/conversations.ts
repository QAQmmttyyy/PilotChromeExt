import { Hono } from 'hono';
import { eq, desc, asc } from 'drizzle-orm';
import { db, schema } from '../db';

const conversationsRoutes = new Hono();

conversationsRoutes.get('/conversations', async (c) => {
  try {
    const conversations = await db
      .select()
      .from(schema.conversations)
      .orderBy(desc(schema.conversations.updatedAt));

    return c.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return c.json({ conversations: [] });
  }
});

conversationsRoutes.get('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id));

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    const rows = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(asc(schema.messages.createdAt));

    const messages = rows.map((row) => ({
      id: row.id,
      role: row.role,
      parts: row.parts,
    }));

    return c.json({ conversation, messages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return c.json({ error: 'Failed to fetch conversation' }, 500);
  }
});

conversationsRoutes.post('/conversations', async (c) => {
  const body = await c.req.json<{ id?: string; title?: string }>();
  
  try {
    const [conversation] = await db
      .insert(schema.conversations)
      .values({ 
        id: body.id || crypto.randomUUID(),
        title: body.title,
      })
      .returning();

    return c.json({ conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return c.json({ error: 'Failed to create conversation' }, 500);
  }
});

conversationsRoutes.delete('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    await db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, id));

    return c.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
  }
});

export { conversationsRoutes };

