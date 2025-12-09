import React from 'react';

const CategoryListScreen = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Gestión de Categorías</h1>
      <p className="text-gray-600">CRUD para crear, editar y eliminar categorías de productos.</p>
      <div className="mt-5 p-4 bg-pink-50 rounded-lg border border-dashed border-pink-300 text-center text-pink-800">
          <p className="mb-0">Tabla de categorías.</p>
      </div>
    </>
  );
};

export default CategoryListScreen;