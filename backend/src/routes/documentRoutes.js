const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');

function createDocumentRouter(controller, storageDirectory) {
  const maxFileSize = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10485760);
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
    throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: storageDirectory,
      filename(req, file, callback) {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: maxFileSize, files: 1, fields: 0 },
  }).single('file');

  const router = express.Router();
  router.post('/upload', controller.identifyUser, (req, res, next) => {
    upload(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          error.code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD';
        } else if (!error.code) {
          error.code = 'INVALID_UPLOAD';
        }
        return next(error);
      }
      next();
    });
  }, controller.upload);
  router.get('/documents', controller.identifyUser, controller.list);
  router.get('/documents/:id/download', controller.identifyUser, controller.download);
  return router;
}

module.exports = createDocumentRouter;