const express = require('express');
const createDocumentRepository = require('./repositories/documentRepository');
const createDocumentService = require('./services/documentService');
const { createDocumentController, handleDocumentError } = require('./controllers/documentController');
const createDocumentRouter = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const repository = createDocumentRepository();
const service = createDocumentService(repository);
const controller = createDocumentController(service);
app.use(createDocumentRouter(controller, repository.storageDirectory));
app.use(handleDocumentError);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
