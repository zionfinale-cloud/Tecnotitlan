import React from 'react';

const ProductListScreen = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Gestión de Productos</h1>
      <p className="text-gray-600">Aquí se mostrará la tabla de todos los productos y las opciones de creación/edición.</p>
      <div className="mt-5 p-4 bg-yellow-50 rounded-lg border border-dashed border-yellow-300 text-center text-yellow-800">
          <p className="mb-0">Tabla de productos y filtros irán aquí.</p>
      </div>
    </>
  );
};

export default ProductListScreen;