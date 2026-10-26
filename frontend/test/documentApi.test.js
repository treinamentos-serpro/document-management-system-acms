import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/documentApi.js';

test('lista documentos pelo proxy com identidade e sinal de cancelamento', async (t) => {
  const documents = [{ id: 'document-1', originalName: 'relatorio.txt' }];
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.headers['X-User-Id'], 'usuario-1');
    assert.equal(options.signal, controller.signal);
    return Response.json({ documents });
  });
  assert.deepEqual(await listDocuments('usuario-1', { signal: controller.signal }), documents);
});

test('envia exatamente um arquivo sem definir Content-Type multipart manualmente', async (t) => {
  const file = new File(['conteudo'], 'relatorio.txt');
  const document = { id: 'document-1', originalName: file.name };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, { 'X-User-Id': 'usuario-1' });
    assert.deepEqual([...options.body.keys()], ['file']);
    assert.equal(options.body.get('file').name, file.name);
    assert.equal(await options.body.get('file').text(), 'conteudo');
    return Response.json({ document }, { status: 201 });
  });
  assert.deepEqual(await uploadDocument(file, 'usuario-1'), document);
});

test('baixa bytes com identidade e codifica o identificador na URL', async (t) => {
  const bytes = new Uint8Array([0, 255, 42]);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents/id%2Fespecial/download');
    assert.equal(options.headers['X-User-Id'], 'usuario-1');
    return new Response(bytes);
  });
  const blob = await downloadDocument('id/especial', 'usuario-1');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test('apresenta erros JSON em todas as operações', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: { message: 'Documento não encontrado.' } }, { status: 404 }));
  for (const operation of [
    () => listDocuments('usuario-1'),
    () => uploadDocument(new File(['a'], 'a.txt'), 'usuario-1'),
    () => downloadDocument('ausente', 'usuario-1'),
  ]) {
    await assert.rejects(operation, /Documento não encontrado\./);
  }
});

test('informa o status de erros não JSON sem exibir conteúdo interno', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('<html>Detalhes internos</html>', { status: 502 }));
  await assert.rejects(() => listDocuments('usuario-1'), {
    message: 'Não foi possível concluir a operação (HTTP 502).',
  });
});

test('informa falhas de rede em português e preserva a causa', async (t) => {
  const cause = new TypeError('fetch failed');
  t.mock.method(globalThis, 'fetch', async () => { throw cause; });
  await assert.rejects(() => listDocuments('usuario-1'), {
    message: 'Não foi possível conectar ao servidor.',
    cause,
  });
});

test('preserva cancelamento de requisições', async (t) => {
  const cause = new DOMException('Cancelado', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => { throw cause; });
  await assert.rejects(() => listDocuments('usuario-1'), cause);
});
