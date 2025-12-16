import React from 'react';

const OrderListScreen = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Gestión de Pedidos</h1>
      <p className="text-gray-600">Aquí se mostrará la tabla de todos los pedidos y la gestión de estados (pago, envío, entrega).</p>
      <div className="mt-5 p-4 bg-green-50 rounded-lg border border-dashed border-green-300 text-center text-green-800">
          <p className="mb-0">Tabla de pedidos y filtros de estado irán aquí.</p>
      </div>
    </>
  );
};

export default OrderListScreen;