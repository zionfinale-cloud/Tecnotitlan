import React from 'react';

const RoleListScreen = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Roles y Permisos (RBAC)</h1>
      <p className="text-gray-600">Gestión de roles y asignación de permisos a cada rol.</p>
      <div className="mt-5 p-4 bg-indigo-50 rounded-lg border border-dashed border-indigo-300 text-center text-indigo-800">
          <p className="mb-0">Tabla de roles y permisos.</p>
      </div>
    </>
  );
};

export default RoleListScreen;