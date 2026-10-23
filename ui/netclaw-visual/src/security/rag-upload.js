import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

// Keep original basenames for document titles, but give each request its own
// staging directory. Ingestion outlives the HTTP 202 response.
export function createRagUpload(intakeDir, maxDocMB) {
  if (!Number.isSafeInteger(maxDocMB) || maxDocMB <= 0) {
    throw new Error('RAG_MAX_DOC_MB must be a positive integer');
  }
  return multer({
    storage: multer.diskStorage({
      destination(req, _file, done) {
        try {
          fs.mkdirSync(intakeDir, { recursive: true });
          req.ragUploadDirectory = fs.mkdtempSync(path.join(intakeDir, 'hud-'));
          done(null, req.ragUploadDirectory);
        } catch (error) { done(error); }
      },
      filename: (_req, file, done) => done(null, path.basename(file.originalname)),
    }),
    limits: { fileSize: maxDocMB * 1024 * 1024, files: 1, fields: 2, fieldSize: 8192, parts: 3 },
  }).single('file');
}

export function cleanupRagUpload(req) {
  if (!req.ragUploadDirectory) return;
  fs.rmSync(req.ragUploadDirectory, { recursive: true, force: true });
  delete req.ragUploadDirectory;
}
