// __define-ocg__ keeping it clean & consistent (ESM)
import express from 'express';
const router = express.Router();

// Import controllers
import { deleteUnverifiedUsers } from '../controllers/adminController.js';

// Import middleware
import { authenticate } from '../middleware/auth.js';

// Admin routes
router.delete('/delete-unverified-users', authenticate, deleteUnverifiedUsers);
router.get('/dashboard', (req, res) => res.send('Admin dashboard working'));
// __define-ocg__ ensure default export for ESM compatibility
export default router; // ✅ changed to ESM export
