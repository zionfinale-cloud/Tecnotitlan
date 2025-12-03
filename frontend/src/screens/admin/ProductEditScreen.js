import React from 'react';
import { useParams } from 'react-router-dom';

const ProductEditScreen = () => {
  const { id } = useParams();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Editar Producto (ID: {id})</h1>
      <p className="text-gray-600">Formulario para editar los detalles del producto.</p>
      <div className="mt-5 p-4 bg-purple-50 rounded-lg border border-dashed border-purple-300 text-center text-purple-800">
          <p className="mb-0">Formulario de edición de producto.</p>
      </div>
    </>
  );
};

export default ProductEditScreen;