function createDocumentController(service) {
  return {
    identifyUser(req, res, next) {
      try {
        res.locals.owner = service.validateOwner(req.get('X-User-Id'));
        next();
      } catch (error) {
        next(error);
      }
    },
    async upload(req, res) {
      const file = req.file && {
        originalName: req.file.originalname,
        size: req.file.size,
        storageName: req.file.filename,
      };
      const document = await service.upload(res.locals.owner, file);
      res.status(201).json({ document });
    },
    async list(req, res) {
      const documents = await service.list(res.locals.owner);
      res.json({ documents });
    },
    async download(req, res, next) {
      const { filePath, originalName } = await service.download(res.locals.owner, req.params.id);
      res.type('application/octet-stream');
      res.download(filePath, originalName, (error) => {
        if (error) {
          if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
            error.code = 'DOCUMENT_NOT_FOUND';
          }
          next(error);
        }
      });
    },
  };
}

function handleDocumentError(error, req, res, next) {
  if (res.headersSent) {
    console.error('Falha após início da resposta de documento.', error);
    return next(error);
  }

  const errors = {
    USER_ID_REQUIRED: [401, 'Identificador de usuário ausente ou inválido.'],
    INVALID_UPLOAD: [400, 'Envie exatamente um arquivo não vazio no campo file.'],
    FILE_TOO_LARGE: [413, 'Arquivo acima do limite permitido.'],
    INVALID_DOCUMENT_ID: [400, 'Identificador de documento inválido.'],
    DOCUMENT_NOT_FOUND: [404, 'Documento não encontrado.'],
  };
  let code = error.code;
  if (!Object.hasOwn(errors, code)) {
    code = req.method === 'POST' ? 'UPLOAD_FAILED'
      : req.path.endsWith('/download') ? 'DOWNLOAD_FAILED' : 'DOCUMENT_LIST_FAILED';
    console.error('Falha na operação de documento.', error);
  }
  const [status, message] = errors[code] || [500, 'Não foi possível concluir a operação.'];
  res.status(status).json({ error: { code, message } });
}

module.exports = { createDocumentController, handleDocumentError };