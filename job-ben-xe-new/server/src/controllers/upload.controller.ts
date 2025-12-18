import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

export const uploadImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ben-xe-manager', // Optional: organize uploads in a folder
      use_filename: true,
      unique_filename: true,
    });

    // Remove file from local uploads folder
    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Try to remove file if it exists and upload failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ message: 'Image upload failed', error });
  }
};
