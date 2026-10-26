# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey acmsnet-serpro!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-acms/issues/1)

---

## Interface de documentos

Inicie o backend com `cd backend && npm run dev` e, em outro terminal, o
frontend com `cd frontend && npm run dev`. Instale as dependências com `npm ci`
em cada diretório se necessário.

Abra `http://localhost:5173`, informe um identificador de usuário e clique em
**Usar identificador**. Selecione um arquivo não vazio e clique em **Enviar**:
a lista é atualizada após o upload. Use **Baixar** para salvar o arquivo com
seu nome original ou **Atualizar lista** para consultar novamente.

O cliente em [frontend/src/services/documentApi.js](frontend/src/services/documentApi.js)
centraliza as chamadas `fetch` com prefixo `/api` e cabeçalho `X-User-Id`.
O proxy de desenvolvimento do Vite remove esse prefixo ao encaminhar ao backend.
Em produção, configure um proxy equivalente.

O identificador é apenas uma convenção de demonstração, **não autenticação**.
Ao trocar o identificador, a interface carrega os documentos do novo usuário.
Os metadados são perdidos quando o backend reinicia.

Valide o frontend com `cd frontend && npm run build && node --test`.
Os testes cobrem o cliente de API e o fluxo integrado pelo proxy Vite com dois
identificadores de usuário.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
