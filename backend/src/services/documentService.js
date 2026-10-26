const { randomUUID } = require('node:crypto');

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function publicDocument(document) {
  const { storageName, ...metadata } = document;
  return metadata;
}

function createDocumentService(repository) {
  function validateOwner(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
      fail('USER_ID_REQUIRED');
    }
    return value.trim();
  }

  return {
    validateOwner,
    async upload(owner, file) {
      try {
        owner = validateOwner(owner);
        if (!file || !file.originalName?.trim() || file.size <= 0) {
          fail('INVALID_UPLOAD');
        }
        const document = {
          id: randomUUID(),
          originalName: file.originalName,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          owner,
          storageName: file.storageName,
        };
        await repository.save(document);
        return publicDocument(document);
      } catch (error) {
        if (file?.storageName) {
          try {
            await repository.removeFile(file.storageName);
          } catch (cleanupError) {
            console.error('Falha ao remover arquivo após upload rejeitado.', cleanupError);
          }
        }
        throw error;
      }
    },
    async list(owner) {
      const documents = await repository.findByOwner(validateOwner(owner));
      return documents
        .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt)
          || first.id.localeCompare(second.id))
        .map(publicDocument);
    },
    async download(owner, id) {
      owner = validateOwner(owner);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        fail('INVALID_DOCUMENT_ID');
      }
      const document = await repository.findById(id);
      if (!document || document.owner !== owner) fail('DOCUMENT_NOT_FOUND');
      try {
        const filePath = await repository.getFilePath(document.storageName);
        return { filePath, originalName: document.originalName };
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
          fail('DOCUMENT_NOT_FOUND');
        }
        throw error;
      }
    },
  };
}

module.exports = createDocumentService;