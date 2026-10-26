import { useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';

function DocumentWorkspace({ userId }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <UploadComponent userId={userId} onUploaded={() => setRefreshKey((key) => key + 1)} />
      <DocumentList userId={userId} refreshKey={refreshKey} />
    </>
  );
}

export default function App() {
  const [userId, setUserId] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');

  function handleIdentify(event) {
    event.preventDefault();
    const owner = userInput.trim();
    if (!owner || owner.length > 128) {
      setError('Informe um identificador de usuário com 1 a 128 caracteres.');
      return;
    }
    setError('');
    setUserId(owner);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Gestão de documentos</h1>
      <p>
        Identificação apenas para demonstração local; não substitui autenticação.
      </p>
      <form onSubmit={handleIdentify}>
        <label htmlFor="user-id">Identificador de usuário </label>
        <input
          id="user-id"
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
          required
          maxLength={128}
        />
        <button type="submit">Usar identificador</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {userId && (
        <>
          <p role="status">Usuário atual: {userId}</p>
          <DocumentWorkspace key={userId} userId={userId} />
        </>
      )}
    </main>
  );
}
