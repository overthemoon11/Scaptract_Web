import express, { Request, Response } from 'express';
import { chatMessage, getChatEvents } from '../api/aiassistant/chat.ts';

const router = express.Router();

// POST /api/aiassistant/chat - Send a chat message
router.post('/chat', chatMessage);

// GET /api/aiassistant/chat/:taskId/events - Get streaming events for a task
router.get('/chat/:taskId/events', getChatEvents);

export default router;

