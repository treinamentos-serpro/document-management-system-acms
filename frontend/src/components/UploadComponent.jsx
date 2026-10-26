import { useRef, useState } from 'react';
import { uploadDocument } from '../services/documentApi.js';

export default function UploadComponent({ userId, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (uploading) return;
    setError('');
    setSuccess('');
    if (!file || file.size === 0) {
      setError('Selecione um arquivo não vazio.');
      return;
    }

    setUploading(true);
    try {
      const document = await uploadDocument(file, userId);
      setSuccess(`Documento "${document.originalName}" enviado com sucesso.`);
      setFile(null);
      inputRef.current.value = '';
      onUploaded();
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-title">
      <h2 id="upload-title">Enviar documento</h2>
      <form onSubmit={handleSubmit} aria-busy={uploading}>
        <label htmlFor="document-file">Arquivo </label>
        <input
          ref={inputRef}
          id="document-file"
          type="file"
          required
          disabled={uploading}
          onChange={(event) => {
            setFile(event.target.files[0] ?? null);
            setError('');
            setSuccess('');
          }}
        />
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
