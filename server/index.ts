import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files (profile images and documents)
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Import API routes
import authRoutes from './routes/auth.ts';
import adminRoutes from './routes/admin.ts';
import documentRoutes from './routes/documents.ts';
import notificationRoutes from './routes/notifications.ts';
import profileRoutes from './routes/profile.ts';
import supportRoutes from './routes/support.ts';
import aiassistantRoutes from './routes/aiassistant.ts';
import ocrWebhookRoutes from './routes/ocr-webhook.ts';
import ocrPagesRoutes from './routes/ocr-pages.ts';
import testDbRoute from './routes/test-db.ts';

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/aiassistant', aiassistantRoutes);
app.use('/api/ocr-webhook', ocrWebhookRoutes);
app.use('/api/ocr-pages', ocrPagesRoutes);
app.use('/api/test-db', testDbRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware (must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

