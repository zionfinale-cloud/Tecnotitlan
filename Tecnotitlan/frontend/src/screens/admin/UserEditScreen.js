import React from 'react';
import { useParams } from 'react-router-dom';

const UserEditScreen = () => {
  const { id } = useParams();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Editar Usuario (ID: {id})</h1>
      <p className="text-gray-600">Formulario para editar el perfil del usuario y sus roles/permisos.</p>
      <div className="mt-5 p-4 bg-red-50 rounded-lg border border-dashed border-red-300 text-center text-red-800">
          <p className="mb-0">Formulario de edición de usuario y asignación de rol.</p>
      </div>
    </>
  );
};

export default UserEditScreen;