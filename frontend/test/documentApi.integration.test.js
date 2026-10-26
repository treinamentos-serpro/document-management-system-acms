import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createServer } from 'vite';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/documentApi.js';

const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const express = require('express');
const createRepository = require('./src/repositories/documentRepository');
const createService = require('./src/services/documentService');
const { createDocumentController, handleDocumentError } = require('./src/controllers/documentController');
const createRouter = require('./src/routes/documentRoutes');

test('cliente integra upload, listagem e download pelo proxy Vite com isolamento por usuário', async (t) => {
  const repository = createRepository();
  const owner = randomUUID();
  const app = express();
  app.use(createRouter(createDocumentController(createService(repository)), repository.storageDirectory));
  app.use(handleDocumentError);

  const backend = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) =>
      backend.close((error) => error ? reject(error) : resolve()));
    for (const document of repository.findByOwner(owner)) {
      await repository.removeFile(document.storageName);
    }
  });
  await once(backend, 'listening');

  const vite = await createServer({
    configFile: false,
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backend.address().port}`,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  });
  t.after(() => vite.close());
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (path, options) =>
    nativeFetch(new URL(path, origin), options));

  assert.deepEqual(await listDocuments(owner), []);
  const content = `Conteúdo do documento ${owner}`;
  const document = await uploadDocument(new File([content], 'relatorio.txt'), owner);
  assert.equal(document.originalName, 'relatorio.txt');
  assert.equal(document.owner, owner);
  assert.deepEqual(await listDocuments(owner), [document]);
  assert.equal(await (await downloadDocument(document.id, owner)).text(), content);

  const otherOwner = randomUUID();
  assert.deepEqual(await listDocuments(otherOwner), []);
  await assert.rejects(() => downloadDocument(document.id, otherOwner), /Documento não encontrado/);
  await assert.rejects(() => listDocuments(''), /Identificador de usuário/);
});
