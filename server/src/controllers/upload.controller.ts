import { Request, Response } from 'express';
import { getStorage } from 'firebase-admin/storage';
import { getApps } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Import to trigger Firebase initialization  
import '../config/database.js';

// Get Firebase Storage bucket (uses default bucket configured in initializeApp)
function getStorageBucket() {
  if (getApps().length === 0) {
    throw new Error('Firebase not initialized. Make sure database.ts is imported first.');
  }
  return getStorage().bucket();
}

export const uploadImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const bucket = getStorageBucket();
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const fileName = `dispatch-images/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;

    // Upload to Firebase Storage
    await bucket.upload(req.file.path, {
      destination: fileName,
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make file publicly accessible
    const file = bucket.file(fileName);
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Remove temp file
    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      url: publicUrl,
      fileName: fileName,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    
    // Try to remove temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ 
      message: 'Image upload failed', 
      error: error.message || 'Unknown error'
    });
  }
};
