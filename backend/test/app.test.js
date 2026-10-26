const { test } = require('node:test');
const assert = require('node:assert');
const { readdir, unlink, readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const createDocumentService = require('../src/services/documentService');
const createDocumentRepository = require('../src/repositories/documentRepository');
const previousLimit = process.env.MAX_FILE_SIZE_BYTES;
process.env.MAX_FILE_SIZE_BYTES = '64';
const app = require('../src/app');
if (previousLimit === undefined) delete process.env.MAX_FILE_SIZE_BYTES;
else process.env.MAX_FILE_SIZE_BYTES = previousLimit;

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('contratos HTTP dos documentos e armazenamento local', async (context) => {
  const storage = path.resolve(__dirname, '../storage');
  const initialFiles = new Set(await readdir(storage));
  const uploadedFiles = new Set();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const filename of uploadedFiles) {
      await unlink(path.join(storage, filename)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const owner = randomUUID();
  const headers = { 'X-User-Id': owner };
  const content = `documento ${owner}`;
  function multipart(fileContent = content, field = 'file') {
    const form = new FormData();
    form.append(field, new Blob([fileContent]), 'relatorio.txt');
    return form;
  }

  await context.test('saúde e identidade obrigatória antes do upload', async () => {
    const health = await fetch(`${baseUrl}/health`);
    assert.strictEqual(health.status, 200);
    assert.deepStrictEqual(await health.json(), { status: 'ok' });
    for (const endpoint of ['/documents', `/documents/${randomUUID()}/download`]) {
      const response = await fetch(`${baseUrl}${endpoint}`);
      assert.strictEqual(response.status, 401);
    }
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: multipart() });
    assert.strictEqual(response.status, 401);
    assert.strictEqual((await response.json()).error.code, 'USER_ID_REQUIRED');
    assert.deepStrictEqual(new Set(await readdir(storage)), initialFiles);
  });

  let document;
  let storedFilename;
  await context.test('upload, metadados públicos e conteúdo no disco', async () => {
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', headers, body: multipart() });
    assert.strictEqual(response.status, 201);
    ({ document } = await response.json());
    assert.strictEqual(document.originalName, 'relatorio.txt');
    assert.strictEqual(document.size, Buffer.byteLength(content));
    assert.strictEqual(document.owner, owner);
    assert.ok(!Number.isNaN(Date.parse(document.uploadedAt)));
    assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    for (const filename of await readdir(storage)) {
      if (!initialFiles.has(filename)
        && await readFile(path.join(storage, filename), 'utf8') === content) {
        storedFilename = filename;
        uploadedFiles.add(filename);
      }
    }
    assert.ok(storedFilename);
    assert.notStrictEqual(storedFilename, document.originalName);
    assert.strictEqual(await readFile(path.join(storage, storedFilename), 'utf8'), content);
  });

  await context.test('listagem e isolamento por dono', async () => {
    const response = await fetch(`${baseUrl}/documents`, { headers });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { documents: [document] });
    const otherUser = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': randomUUID() } });
    assert.deepStrictEqual(await otherUser.json(), { documents: [] });
  });

  await context.test('download e documento ausente ou de outro usuário', async () => {
    const endpoint = `${baseUrl}/documents/${document.id}/download`;
    const response = await fetch(endpoint, { headers });
    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment;.*relatorio\.txt/);
    assert.strictEqual(await response.text(), content);
    const forbidden = await fetch(endpoint, { headers: { 'X-User-Id': randomUUID() } });
    const missing = await fetch(`${baseUrl}/documents/${randomUUID()}/download`, { headers });
    assert.strictEqual(forbidden.status, 404);
    assert.strictEqual(missing.status, 404);
    assert.deepStrictEqual(await forbidden.json(), await missing.json());
    const invalid = await fetch(`${baseUrl}/documents/invalido/download`, { headers });
    assert.strictEqual(invalid.status, 400);
  });

  await context.test('uploads inválidos não deixam arquivos', async () => {
    const before = new Set(await readdir(storage));
    const multiple = multipart();
    multiple.append('file', new Blob(['outro']), 'outro.txt');
    for (const body of [new FormData(), multipart(''), multipart('teste', 'wrong'), multiple]) {
      const response = await fetch(`${baseUrl}/upload`, { method: 'POST', headers, body });
      assert.strictEqual(response.status, 400);
      assert.strictEqual((await response.json()).error.code, 'INVALID_UPLOAD');
    }
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST', headers, body: multipart('a'.repeat(65)),
    });
    assert.strictEqual(response.status, 413);
    assert.strictEqual((await response.json()).error.code, 'FILE_TOO_LARGE');
    assert.deepStrictEqual(new Set(await readdir(storage)), before);
  });

  await context.test('arquivo removido do disco retorna 404', async () => {
    await unlink(path.join(storage, storedFilename));
    const response = await fetch(`${baseUrl}/documents/${document.id}/download`, { headers });
    assert.strictEqual(response.status, 404);
    assert.strictEqual((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
  });
});

test('serviço remove o arquivo quando o registro de metadados falha', async () => {
  const failure = new Error('Falha simulada.');
  const removed = [];
  const service = createDocumentService({
    async save() { throw failure; },
    async removeFile(storageName) { removed.push(storageName); },
  });
  await assert.rejects(service.upload('usuario', {
    storageName: 'arquivo-teste', originalName: 'teste.txt', size: 5,
  }), (error) => error === failure);
  assert.deepStrictEqual(removed, ['arquivo-teste']);
});

test('serviço ordena metadados e remove os detalhes internos', async () => {
  const service = createDocumentService({
    findByOwner(owner) {
      assert.strictEqual(owner, 'usuario');
      return [
        { id: 'b', uploadedAt: '2026-10-25T00:00:00.000Z', storageName: 'segredo' },
        { id: 'c', uploadedAt: '2026-10-26T00:00:00.000Z', storageName: 'segredo' },
        { id: 'a', uploadedAt: '2026-10-26T00:00:00.000Z', storageName: 'segredo' },
      ];
    },
  });
  const documents = await service.list(' usuario ');
  assert.deepStrictEqual(documents.map((document) => document.id), ['a', 'c', 'b']);
  assert.ok(documents.every((document) => !Object.hasOwn(document, 'storageName')));
  await assert.rejects(service.list(' '.repeat(5)), { code: 'USER_ID_REQUIRED' });
  await assert.rejects(service.list('a'.repeat(129)), { code: 'USER_ID_REQUIRED' });
});

test('repositório mantém metadados em memória e impede caminhos externos', async () => {
  const repository = createDocumentRepository();
  const document = { id: randomUUID(), owner: 'usuario', storageName: randomUUID() };
  repository.save(document);
  document.owner = 'alterado';
  assert.strictEqual(repository.findById(document.id).owner, 'usuario');
  assert.deepStrictEqual(repository.findByOwner('outro'), []);
  assert.strictEqual(createDocumentRepository().findById(document.id), undefined);
  await assert.rejects(repository.getFilePath('../../package.json'));
  await assert.rejects(repository.removeFile('../package.json'));
});
