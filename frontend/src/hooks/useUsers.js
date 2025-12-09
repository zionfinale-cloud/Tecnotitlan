import { useEffect } from 'react';
import useApi from './useApi';

/**
 * Hook para gestionar la obtención de la lista de usuarios.
 */
export const useUsers = () => {
    const { data: usersData, loading, error, request: fetchUsers } = useApi();

    useEffect(() => {
        // Hacemos la llamada a la API para obtener todos los usuarios
        fetchUsers('get', '/users');
    }, [fetchUsers]);

    const handleDeleteUser = (userId) => {
        // Lógica para eliminar un usuario (se implementará después)
        console.log(`Eliminar usuario con ID: ${userId}`);
        // Aquí se llamaría a request('delete', `/users/${userId}`);
        // y luego se refrescaría la lista.
    };

    return { users: usersData?.data || [], loading, error, handleDeleteUser };
};

export default useUsers;