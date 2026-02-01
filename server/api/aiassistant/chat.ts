import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import { User } from '@shared/types/index.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

interface DifyRequestBody {
  query: string;
  inputs?: Record<string, unknown>;
  response_mode?: string;
  user?: string;
  conversation_id?: string;
}

const DIFY_API_URL = process.env.DIFY_API_URL;
const DIFY_API_KEY = process.env.DIFY_CHATBOT_API_KEY_V1;

if (!DIFY_API_URL) {
  throw new Error('DIFY_API_URL environment variable is required');
}

if (!DIFY_API_KEY) {
  throw new Error('DIFY_CHATBOT_API_KEY_V1 environment variable is required');
}

export async function chatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await requireAuth(req);
    const { query, conversation_id } = req.body as DifyRequestBody;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const body: DifyRequestBody = {
      query: query.trim(),
      inputs: {},
      response_mode: 'streaming',
      user: user.email || user.id.toString(),
    };

    if (conversation_id) {
      body.conversation_id = conversation_id;
    }

    // Forward the request to Dify API
    const difyResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      res.status(difyResponse.status).json({ error: errorText || 'Failed to connect to Dify API' });
      return;
    }

    const contentType = difyResponse.headers.get('content-type') || '';

    // If Dify streams directly, forward the stream
    if (contentType.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.status(200);
      res.flushHeaders();

      if (!difyResponse.body) {
        res.status(500).json({ error: 'No response body from Dify' });
        return;
      }

      const reader = difyResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            res.write(chunk);
            // Force flush the response to client
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        }
      } catch (streamError) {
        console.error('Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        } else {
          res.end();
        }
      }
      return;
    }

    // Otherwise, expect JSON with task_id
    const json = await difyResponse.json() as { task_id?: string; conversation_id?: string };
    
    if (!json.task_id) {
      res.status(500).json({ error: 'No task ID returned from Dify' });
      return;
    }

    // Return task_id and conversation_id to client
    res.json({
      task_id: json.task_id,
      conversation_id: json.conversation_id || conversation_id,
    });
  } catch (error: any) {
    console.error('Chat message error:', error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function getChatEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await requireAuth(req);
    const { taskId } = req.params;

    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required' });
      return;
    }

    // Forward the request to Dify API
    const difyResponse = await fetch(`${DIFY_API_URL}/chat-messages/${taskId}/events`, {
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    if (!difyResponse.ok || !difyResponse.body) {
      res.status(difyResponse.status || 500).json({ error: 'Failed to fetch events from Dify' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    res.flushHeaders();

    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          res.write(chunk);
          // Force flush the response to client
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      }
    } catch (streamError) {
      console.error('Stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    }
  } catch (error: any) {
    console.error('Get chat events error:', error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

