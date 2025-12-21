import React, { useState, useEffect, useCallback } from 'react';
import { Button, Form, Spinner, Alert } from 'react-bootstrap';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Estilos del editor
import useApi from '../../hooks/useApi';

const LegalPagesScreen = () => {
  // Estados para el contenido de cada página
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsOfService, setTermsOfService] = useState('');

  // Hooks para interactuar con la API
  const { data, loading, error, request } = useApi();

  // Cargar el contenido inicial de las páginas
  useEffect(() => {
    // Hacemos una sola llamada que traiga todas las configuraciones
    request('get', '/api/settings');
  }, [request]);

  // Cuando los datos de configuración se cargan, actualizamos los estados locales
  useEffect(() => {
    if (data?.data) {
      const settingsMap = data.data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      setPrivacyPolicy(settingsMap.page_privacy_policy || '');
      setTermsOfService(settingsMap.page_terms_of_service || '');
    }
  }, [data]);

  const handleSave = async () => {
    const settingsToUpdate = [
      { key: 'page_privacy_policy', value: privacyPolicy },
      { key: 'page_terms_of_service', value: termsOfService },
    ];
    // La ruta PUT /api/settings debe estar preparada para recibir un array de configuraciones
    await request('put', '/api/settings', { settings: settingsToUpdate }, 'Configuración guardada con éxito.');
  };

  // Módulos para la barra de herramientas del editor
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['link'],
      ['clean']
    ],
  };

  if (loading && !data) return <Spinner animation="border" />;

  return (
    <div>
      <h1 className="mb-4">Editar Páginas Legales</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Form.Group className="mb-5">
          <Form.Label as="h4">Política de Privacidad</Form.Label>
          <ReactQuill
            theme="snow"
            value={privacyPolicy}
            onChange={setPrivacyPolicy}
            modules={quillModules}
            style={{ height: '250px', marginBottom: '4rem' }}
          />
        </Form.Group>

        <Form.Group className="mb-5">
          <Form.Label as="h4">Términos de Servicio</Form.Label>
          <ReactQuill
            theme="snow"
            value={termsOfService}
            onChange={setTermsOfService}
            modules={quillModules}
            style={{ height: '250px', marginBottom: '4rem' }}
          />
        </Form.Group>

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? <><Spinner as="span" animation="border" size="sm" /> Guardando...</> : 'Guardar Cambios'}
        </Button>
      </Form>
    </div>
  );
};

export default LegalPagesScreen;