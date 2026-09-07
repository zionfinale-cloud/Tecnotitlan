import React, { useState, useEffect } from 'react';
import { Button, Form, Spinner, Alert } from 'react-bootstrap';
import useApi from '../../hooks/useApi';
import SafeHtmlEditor from '../../components/SafeHtmlEditor';

const LegalPagesScreen = () => {
  // Estados para el contenido de cada página
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsOfService, setTermsOfService] = useState('');

  // Hooks para interactuar con la API
  const { data, loading, error, request } = useApi();

  // Cargar el contenido inicial de las páginas
  useEffect(() => {
    // Hacemos una sola llamada que traiga todas las configuraciones
    request('get', '/settings');
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
    await request('put', '/settings', { settings: settingsToUpdate }, 'Configuración guardada con éxito.');
  };

  if (loading && !data) return <Spinner animation="border" />;

  return (
    <div>
      <h1 className="mb-4">Editar Páginas Legales</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Form.Group>
          <SafeHtmlEditor
            id="privacy-policy-editor"
            label="Política de Privacidad"
            value={privacyPolicy}
            onChange={setPrivacyPolicy}
          />
        </Form.Group>

        <Form.Group>
          <SafeHtmlEditor
            id="terms-of-service-editor"
            label="Términos de Servicio"
            value={termsOfService}
            onChange={setTermsOfService}
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
