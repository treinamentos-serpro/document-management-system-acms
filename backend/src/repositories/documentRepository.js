const { mkdirSync } = require('node:fs');
const { access, unlink } = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository() {
  const documents = new Map();
  const storageDirectory = path.resolve(__dirname, '../../storage');
  mkdirSync(storageDirectory, { recursive: true });

  function resolvePath(storageName) {
    if (!storageName || path.basename(storageName) !== storageName) {
      throw new Error('Nome de armazenamento inválido.');
    }
    const filePath = path.resolve(storageDirectory, storageName);
    if (path.dirname(filePath) !== storageDirectory) {
      throw new Error('Caminho de armazenamento inválido.');
    }
    return filePath;
  }

  return {
    storageDirectory,
    save(document) {
      documents.set(document.id, { ...document });
    },
    findById(id) {
      const document = documents.get(id);
      return document ? { ...document } : undefined;
    },
    findByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .map((document) => ({ ...document }));
    },
    async getFilePath(storageName) {
      const filePath = resolvePath(storageName);
      await access(filePath);
      return filePath;
    },
    async removeFile(storageName) {
      try {
        await unlink(resolvePath(storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
  };
}

module.exports = createDocumentRepository;