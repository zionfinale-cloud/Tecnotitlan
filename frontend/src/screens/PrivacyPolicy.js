import React, { useEffect, useState } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import useApi from '../hooks/useApi';

const defaultPrivacyPolicy = `
  <p><strong>Ultima actualizacion:</strong> 5 de julio de 2026</p>
  <p>
    Tecnotitlan protege los datos personales de clientes, usuarios y visitantes que interactuan con nuestra tienda,
    paneles de soporte, medios de contacto y canales de venta.
  </p>
  <h2>Datos que podemos recopilar</h2>
  <p>
    Podemos tratar nombre, correo electronico, telefono, direccion de envio, datos de facturacion cuando aplique,
    informacion de pedidos, estado de pago, guia de envio, mensajes de soporte y datos necesarios para operar ventas
    en la web y marketplaces.
  </p>
  <h2>Finalidades</h2>
  <p>
    Usamos la informacion para crear cuentas, procesar pedidos, confirmar pagos, coordinar envios, dar seguimiento
    postventa, atender soporte, gestionar devoluciones, prevenir fraude y cumplir obligaciones legales, fiscales y
    operativas.
  </p>
  <h2>Pagos</h2>
  <p>
    Los pagos con tarjeta se procesan mediante proveedores externos de pago. Tecnotitlan no almacena numeros completos
    de tarjeta ni codigos de seguridad.
  </p>
  <h2>Transferencias</h2>
  <p>
    Podemos compartir datos personales con proveedores de pago, paqueterias, servicios de correo, hosting, base de datos,
    herramientas de automatizacion, marketplaces y autoridades cuando sea necesario para operar el servicio o cumplir la ley.
  </p>
  <h2>Seguridad</h2>
  <p>
    Aplicamos controles de acceso, uso de HTTPS, configuracion protegida de secretos, roles administrativos y medidas
    razonables para proteger la informacion.
  </p>
  <h2>Derechos del titular</h2>
  <p>
    Puedes solicitar acceso, rectificacion, actualizacion o eliminacion de tus datos cuando corresponda legalmente.
    Para ejercer tus derechos o realizar preguntas sobre privacidad, escribenos a
    <a href="mailto:hola@tecnotitlan.com.mx">hola@tecnotitlan.com.mx</a>.
  </p>
  <h2>Conservacion</h2>
  <p>
    Conservamos la informacion solo durante el tiempo necesario para operar pedidos, soporte, garantias, obligaciones
    fiscales, prevencion de fraude y requerimientos legales o de marketplaces.
  </p>
`;

const PrivacyPolicy = () => {
  const { data, loading, request } = useApi();
  const [content, setContent] = useState(defaultPrivacyPolicy);

  useEffect(() => {
    request('get', '/settings/public').catch(() => {
      setContent(defaultPrivacyPolicy);
    });
  }, [request]);

  useEffect(() => {
    if (data?.data) {
      const settingsMap = data.data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      setContent(settingsMap.page_privacy_policy || defaultPrivacyPolicy);
    }
  }, [data]);

  return (
    <Container className="py-5">
      <h1 className="mb-4">Aviso de Privacidad - Tecnotitlan</h1>
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </Container>
  );
};

export default PrivacyPolicy;
