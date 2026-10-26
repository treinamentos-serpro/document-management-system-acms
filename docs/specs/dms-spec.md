# Especificação - Document Management System

## 1. Objetivo

Oferecer uma aplicação web para que usuários enviem, consultem e baixem seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória nesta primeira versão.

## 2. Escopo

### Dentro do escopo

- Upload de um arquivo por requisição.
- Listagem dos metadados dos documentos do usuário identificado na requisição.
- Download de um documento do próprio usuário por identificador.
- Armazenamento dos arquivos em `backend/storage` usando `multer` com `diskStorage`.
- Armazenamento em memória dos metadados durante a execução do processo.
- Interface web React que consome a API por `fetch` usando o prefixo `/api`.
- Tratamento de entrada inválida, documento inexistente, falhas de filesystem e limite de upload.

### Fora do escopo

- Provedores externos, armazenamento em nuvem ou banco de dados.
- Persistência de metadados entre reinícios do backend.
- Autenticação, cadastro de usuários, autorização baseada em papéis ou gestão de contas.
- Versionamento, edição, compartilhamento, exclusão e busca avançada de documentos.
- Upload múltiplo, processamento de conteúdo, antivírus ou OCR.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um arquivo pelo formulário de upload. | Uma requisição válida armazena o conteúdo em `backend/storage` e retorna os metadados públicos com status `201`. |
| RF-02 | O upload exige exatamente um arquivo no campo multipart `file`. | Requisições sem arquivo, com campo incorreto ou com mais de um arquivo são rejeitadas com erro JSON, sem registrar metadados. |
| RF-03 | O sistema associa cada documento ao usuário da requisição. | O identificador de usuário é obrigatório; documentos não são listados nem baixados por outro identificador. |
| RF-04 | O usuário pode listar seus documentos. | A resposta contém somente documentos do usuário corrente, ordenados do mais recente para o mais antigo. Lista vazia retorna `200` e array vazio. |
| RF-05 | O usuário pode baixar um documento pelo identificador. | Um documento existente e pertencente ao usuário é enviado como anexo binário usando o nome original como nome de download. |
| RF-06 | O sistema não revela a existência de documentos de outro usuário. | Um identificador inexistente ou pertencente a outro usuário resulta em `404` com a mesma estrutura de erro. |
| RF-07 | O sistema rejeita uploads acima do limite configurado. | O limite é aplicado antes da persistência dos metadados e a resposta usa status `413`. |
| RF-08 | O sistema trata falhas de gravação e leitura de arquivos. | Uma falha não produz metadados válidos apontando para arquivo inexistente; a API responde com erro JSON enquanto ainda for possível enviar uma resposta HTTP. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local em `backend/storage`, usando `multer` com `diskStorage`; não usar serviços externos. |
| RNF-02 | Os metadados ficam em memória e são perdidos quando o processo do backend reinicia. |
| RNF-03 | O backend segue o fluxo `routes -> controllers -> services -> repositories`; dependências apontam para dentro e regras de negócio não dependem de Express ou Multer. |
| RNF-04 | O frontend usa componentes funcionais React e acessa a API com `fetch` em `/api`; o proxy Vite remove `/api` e encaminha para o backend local. |
| RNF-05 | Configurações operacionais são obtidas de variáveis de ambiente; `PORT` mantém o padrão `3000` e `MAX_FILE_SIZE_BYTES` mantém o padrão de `10485760` bytes (10 MiB). |
| RNF-06 | Nomes de arquivo fornecidos pelo cliente não são usados para compor caminhos no filesystem. O nome físico é gerado pela aplicação e caminhos resolvidos devem permanecer dentro de `backend/storage`. |
| RNF-07 | Respostas de erro da API não incluem stack trace, caminho local, nome físico ou detalhes internos do filesystem. |
| RNF-08 | Metadados, inclusive o identificador do usuário, são serializáveis em JSON. Datas são representadas em UTC no formato ISO 8601. |
| RNF-09 | Testes do backend usam o runner nativo `node:test`; o projeto permanece em JavaScript, CommonJS no backend e ESM no frontend. |

### Limites e identidade do usuário no MVP

Não há autenticação no seed atual. Para permitir o isolamento funcional entre usuários sem introduzir um sistema de contas, o MVP usa o cabeçalho `X-User-Id` como identidade fornecida pela aplicação chamadora. O valor deve ser não vazio após remoção de espaços e ter no máximo 128 caracteres. Ausência ou valor inválido resulta em `401`.

Esse cabeçalho não comprova a identidade de quem fez a requisição: qualquer cliente capaz de chamar a API pode escolher outro valor. A solução serve apenas para desenvolvimento/demonstração local, não é uma barreira de segurança para produção e deverá ser substituída por identidade obtida de autenticação confiável antes de expor o serviço a usuários reais.

## 5. Modelo de dados

### Metadados públicos do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | sim | Identificador único gerado pela aplicação, preferencialmente UUID. |
| `originalName` | string | sim | Nome original recebido no upload; usado somente para exibição e nome de download, nunca como caminho físico. |
| `size` | number | sim | Tamanho do conteúdo em bytes. Deve ser maior que zero. |
| `uploadedAt` | string | sim | Data/hora UTC do recebimento, em ISO 8601. |
| `owner` | string | sim | Identificador de usuário derivado de `X-User-Id`. |

### Metadados internos de persistência

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `storageName` | string | Nome aleatório gerado pela aplicação para localizar o arquivo em `backend/storage`; não é exposto na API. |

Os metadados públicos não incluem caminho absoluto, `storageName` ou qualquer informação interna de armazenamento. O tipo MIME declarado pelo cliente não é considerado confiável e não faz parte do contrato mínimo do recurso.

## 6. Contratos de API

O backend expõe as rotas sem prefixo `/api`. No desenvolvimento, o proxy do Vite encaminha `/api/...` ao backend e remove esse prefixo. Todas as respostas JSON usam `Content-Type: application/json; charset=utf-8`.

### Formato de erro

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Documento não encontrado."
  }
}
```

`code` é estável para consumo pelo frontend; `message` é uma mensagem segura para apresentação. Respostas de download bem-sucedidas são binárias, não JSON.

### `POST /upload`

Envia um arquivo no campo multipart `file`. Enviar também o cabeçalho `X-User-Id`.

**Sucesso - `201 Created`**

```json
{
  "document": {
    "id": "0d20b474-27be-4f69-a12f-b909a3e9fc25",
    "originalName": "relatorio.pdf",
    "size": 24576,
    "uploadedAt": "2026-10-26T12:00:00.000Z",
    "owner": "usuario-123"
  }
}
```

**Erros previstos**

| Status | Código | Situação |
| --- | --- | --- |
| `400` | `INVALID_UPLOAD` | Campo ausente/incorreto, nome vazio ou conteúdo vazio. |
| `401` | `USER_ID_REQUIRED` | Cabeçalho `X-User-Id` ausente ou inválido. |
| `413` | `FILE_TOO_LARGE` | Arquivo acima de `MAX_FILE_SIZE_BYTES`. |
| `500` | `UPLOAD_FAILED` | Falha inesperada ao gravar o arquivo ou registrar os metadados. |

Se a gravação do arquivo ocorrer mas o registro de metadados falhar, o arquivo recém-gravado deve ser removido para evitar órfãos sempre que possível.

### `GET /documents`

Lista documentos do usuário identificado por `X-User-Id`. Não aceita parâmetros de usuário na query string.

**Sucesso - `200 OK`**

```json
{
  "documents": [
    {
      "id": "0d20b474-27be-4f69-a12f-b909a3e9fc25",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-10-26T12:00:00.000Z",
      "owner": "usuario-123"
    }
  ]
}
```

Lista vazia: `{"documents": []}`. Ordenação: `uploadedAt` decrescente; em caso de empate, ordenar por `id` para resultado determinístico.

**Erros previstos**

| Status | Código | Situação |
| --- | --- | --- |
| `401` | `USER_ID_REQUIRED` | Cabeçalho `X-User-Id` ausente ou inválido. |
| `500` | `DOCUMENT_LIST_FAILED` | Falha inesperada ao consultar o repositório. |

### `GET /documents/:id/download`

Baixa o arquivo identificado por `id`, desde que pertença ao usuário informado em `X-User-Id`.

**Sucesso - `200 OK`**

- Corpo: bytes do arquivo.
- `Content-Disposition: attachment` com `originalName` devidamente codificado/escapado pelo mecanismo HTTP usado.
- `Content-Type`: tipo identificado pela aplicação, quando disponível; caso contrário, `application/octet-stream`.

**Erros previstos antes do início do envio do corpo**

| Status | Código | Situação |
| --- | --- | --- |
| `400` | `INVALID_DOCUMENT_ID` | Identificador malformado ou vazio. |
| `401` | `USER_ID_REQUIRED` | Cabeçalho `X-User-Id` ausente ou inválido. |
| `404` | `DOCUMENT_NOT_FOUND` | Documento inexistente, de outro usuário ou arquivo local ausente. |
| `500` | `DOWNLOAD_FAILED` | Falha inesperada de leitura antes do início da resposta. |

Após o início do stream, não é possível substituir com segurança a resposta por JSON; a conexão deve ser encerrada e o erro registrado sem expor dados internos ao cliente.

### Endpoint existente de saúde

`GET /health` permanece como endpoint operacional do seed e responde `200` com `{"status":"ok"}`. Não faz parte dos fluxos de documentos.

## 7. Decisões arquiteturais

### Backend

- `routes/`: registra `POST /upload`, `GET /documents` e `GET /documents/:id/download`; associa middleware de upload e encaminha ao controller.
- `controllers/`: lê cabeçalhos/parâmetros/arquivo recebido, valida o contrato HTTP, chama serviços e traduz resultados em status, headers e corpo. Não contém regras de persistência.
- `services/`: aplica regras do caso de uso, valida identidade e propriedade, orquestra metadados e operações de arquivo. Não importa Express nem Multer.
- `repositories/`: fornece operações para metadados em memória e arquivos locais. A persistência física usa apenas filesystem local.
- `app.js`: compõe as dependências, middleware, rotas e tratamento centralizado de erros; mantém o endpoint `/health`.
- `multer` com `diskStorage` recebe arquivos em diretório local fixo `backend/storage`, limite definido por configuração e nome físico gerado pela aplicação. Middleware de upload pertence à borda HTTP e não transfere a dependência de Multer aos serviços.
- Operações de criação coordenam arquivo e metadados: se o cadastro falhar depois da gravação, tentar remover o arquivo. A consistência entre memória e filesystem é limitada e não substitui uma transação durável.

### Frontend

- Organização em `components/`, `pages/` e `services/`, seguindo o seed existente.
- Componentes sugeridos no seed: upload, listagem e ação de download.
- A camada de serviço encapsula `fetch`, envia `X-User-Id`, interpreta erros JSON e usa URLs `/api/...` do proxy Vite.
- O frontend deve apresentar estados de carregamento, lista vazia, sucesso e erro, além de impedir envios repetidos enquanto o upload estiver em andamento.

### Configuração e operação

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Limite de tamanho do upload (10 MiB). Deve ser inteiro positivo. |

O diretório de armazenamento não é configurável nesta fase: permanece em `backend/storage`, conforme a restrição do projeto. A aplicação deve garantir que o diretório exista ou criá-lo na inicialização, tratando falha de inicialização de forma explícita.

## 8. Plano de execução

Este plano registra etapas futuras. Nesta entrega, somente este documento de especificação deve ser criado; não executar alterações em arquivos de backend ou frontend.

1. Revisar e aprovar os requisitos, incluindo o limite de arquivo e a limitação do cabeçalho de identidade do MVP.
2. Implementar repositórios de metadados em memória e de arquivos locais, com testes unitários para isolamento por usuário e caminhos de armazenamento.
3. Implementar serviços de upload, listagem e download, incluindo limpeza compensatória de arquivos quando o registro de metadados falhar.
4. Implementar controllers, rotas, configuração Multer e tratamento centralizado de erros; preservar `/health`.
5. Adicionar testes de integração backend para contratos HTTP, limites, propriedade dos documentos, arquivos ausentes e falhas relevantes.
6. Implementar serviço e componentes React de upload, listagem e download consumindo a API pelo proxy `/api`.
7. Verificar build do frontend e testes do backend; validar manualmente o fluxo completo com dois identificadores de usuário distintos.

## 9. Riscos e critérios para evolução

- Reinício do backend remove os metadados da memória, embora arquivos continuem no disco. A evolução para persistência durável exige mudança explícita de escopo e não deve introduzir armazenamento externo sem aprovação.
- `X-User-Id` é apenas um identificador declarado pelo cliente; não oferece autenticação. Antes de qualquer implantação multiusuário acessível pela rede, substituir esse mecanismo por identidade validada pelo servidor.
- Arquivos órfãos podem existir se o processo cair entre gravar o arquivo e registrar metadados. Uma rotina de reconciliação não faz parte do MVP.
- Nomes e tipos MIME enviados pelo cliente são dados não confiáveis. Usar nome físico aleatório, escapar o nome de download e não tratar MIME declarado como validação de conteúdo.
- Definir posteriormente allowlist de tipos, verificação de conteúdo e política de retenção conforme o domínio de uso; esses controles não são presumidos nesta versão.
