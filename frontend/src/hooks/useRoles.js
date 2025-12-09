import { useEffect, useCallback } from 'react';
import useApi from './useApi';

/**
 * Hook para gestionar la obtención de la lista de roles.
 */
export const useRoles = () => {
    const { data: rolesData, loading, error, request: fetchRoles } = useApi();

    const refreshRoles = useCallback(() => {
        fetchRoles('get', '/roles');
    }, [fetchRoles]);

    useEffect(() => {
        refreshRoles();
    }, [refreshRoles]);

    const handleDeleteRole = (roleId) => {
        console.log(`Eliminar rol con ID: ${roleId}`);
    };

    return { roles: rolesData?.data || [], loading, error, handleDeleteRole };
};

export default useRoles;