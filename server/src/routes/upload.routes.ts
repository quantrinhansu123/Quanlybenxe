import { Router } from 'express';
import { uploadImage } from '../controllers/upload.controller.js';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Protect upload route
router.use(authenticate);

// 'image' is the field name in the form-data
router.post('/', upload.single('image'), uploadImage);

export default router;
