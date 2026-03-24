import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { wahaWebhookHandler } from './controllers/webhookController';
import { startReminderService } from './services/reminderService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Mojib Sales Agent Backend is running.' });
});

// Webhook endpoint for WAHA messages
app.post('/waha/webhook', wahaWebhookHandler);

import { adminImpersonateHandler } from './controllers/adminController';
app.post('/api/admin/impersonate', adminImpersonateHandler);

import { sendBulkMarketingHandler } from './controllers/marketingController';
app.post('/api/marketing/bulk-send', sendBulkMarketingHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start the background reminder service
  startReminderService();
});
