import React from 'react';

const WhatsappSettingsScreen = () => {
  return (
    <>
      <h2 className="text-2xl font-bold mb-4">Integración WhatsApp</h2>
      <p className="text-gray-600">Configuración para vincular el cliente de WhatsApp y automatizar notificaciones.</p>
      <div className="mt-5 p-4 bg-green-50 rounded-lg border border-dashed border-green-300 text-center text-green-800">
          <p className="mb-0">Aquí irá el QR code y el estado de la conexión de WhatsApp.</p>
      </div>
    </>
  );
};

export default WhatsappSettingsScreen;