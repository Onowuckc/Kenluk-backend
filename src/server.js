import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('📁 Created logs directory');
}

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import ratesRoutes from './routes/rates.js';
import kycRoutes from './routes/kyc.js';
import paymentRoutes from './routes/payments.js';
import simulationRoutes from './routes/simulations.js';
import webhookRoutes from './routes/webhooks.js';
import walletRoutes from './routes/walletRoutes.js';
import fidelityPaymentRoutes from './routes/fidelityPaymentRoutes.js';
import beneficiaryRoutes from './routes/beneficiaries.js';
import logsRoutes from './routes/logs.js';
import contactRoutes from './routes/contact.js';
import { subscribeReapWebhooks } from './utils/reapWebhookSubscription.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import requestContext from './middleware/requestContext.js';

// Import database connection
import connectDB from './config/database.js';
// Import SMTP verification (Mailtrap API client)


// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB().then(() => {
  // Register Reap webhook subscriptions after DB is ready.
  // Safe to call on every boot — duplicate subscriptions are silently skipped.
  subscribeReapWebhooks();
});

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", process.env.CLIENT_URL, "https://kenluk-frontend.up.railway.app", "https://www.kenluk.com"],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  credentials: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
}));
app.options('*', cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", process.env.CLIENT_URL, "https://kenluk-frontend.up.railway.app", "https://www.kenluk.com"],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  credentials: true
}));

// Keep the raw webhook body for Reap signature verification.
app.use('/api/webhooks/reap', express.raw({
  type: ['application/json', 'application/vnd.api+json'],
  limit: '10mb'
}));

const jsonBodyParser = express.json({ limit: '10mb' });
app.use((req, res, next) => {
  if (req.path === '/api/webhooks/reap' && req.method === 'POST') {
    return next();
  }
  return jsonBodyParser(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(requestContext);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/fidelity', fidelityPaymentRoutes);
app.use('/api/simulations', simulationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running successfully',
    timestamp: new Date().toISOString()
  });
});

// Log all registered routes at startup
const logRoutes = () => {
  console.log('\n📋 Registered Routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      console.log(`  ${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      const basePath = middleware.regexp.source
        .replace('^\\', '')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\$$/, '');
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
          console.log(`  ${methods} ${basePath}${handler.route.path}`);
        }
      });
    }
  });
  console.log('');
};


// Error handling middleware
app.use(errorHandler);

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  logRoutes();
});

export default app;
