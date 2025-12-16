import React from 'react';

const UserListScreen = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Gestión de Usuarios</h1>
      <p className="text-gray-600">Aquí se mostrará la lista de usuarios y se podrán asignar roles y permisos.</p>
      <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-dashed border-blue-300 text-center text-blue-800">
          <p className="mb-0">Tabla de usuarios y asignación de roles irán aquí.</p>
      </div>
    </>
  );
};

export default UserListScreen;