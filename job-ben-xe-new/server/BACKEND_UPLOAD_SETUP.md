# Image Upload Setup

## Overview
The backend now supports image uploads using Cloudinary. Images are temporarily stored in `server/uploads` before being uploaded to Cloudinary.

## Configuration
Ensure the following environment variables are set in `server/.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## API Endpoint
**POST** `/api/upload`

### Request
- **Content-Type**: `multipart/form-data`
- **Body**:
  - `image`: The image file to upload (Max 5MB, formats: jpeg, jpg, png, gif, webp)

### Response
**Success (200 OK)**
```json
{
  "url": "https://res.cloudinary.com/...",
  "public_id": "ben-xe-manager/..."
}
```

**Error (400 Bad Request)**
```json
{
  "message": "No file uploaded"
}
```

**Error (500 Internal Server Error)**
```json
{
  "message": "Image upload failed",
  "error": ...
}
```

## Usage in Frontend
1. Create a `FormData` object.
2. Append the file to the `image` field.
3. Send a POST request to `/api/upload`.
4. Use the returned `url` to save the image URL in the database (e.g., for `vehicle.image_url`).
