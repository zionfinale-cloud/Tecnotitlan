import React from 'react';
import styles from './RoleListScreen.module.css';
import useRoles from '../../hooks/useRoles';
import RoleTable from '../../components/RoleTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import Message from '../../components/Message';

const RoleListScreen = () => {
  const { roles, loading, error, handleDeleteRole } = useRoles();

  return (
    <>
      <h1 className={styles.title}>Roles y Permisos (RBAC)</h1>
      <p className={styles.subtitle}>Gestión de roles y asignación de permisos a cada rol.</p>
      
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <RoleTable roles={roles} onDelete={handleDeleteRole} />
      )}
    </>
  );
};

export default RoleListScreen;