import React from 'react';
import styles from './UserListScreen.module.css';
import useUsers from '../../hooks/useUsers';
import UserTable from '../../components/UserTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import Message from '../../components/Message';

const UserListScreen = () => {
  const { users, loading, error, handleDeleteUser } = useUsers();

  return (
    <>
      <h1 className={styles.title}>Gestión de Usuarios</h1>
      <p className={styles.subtitle}>Aquí se mostrará la lista de usuarios y se podrán asignar roles y permisos.</p>
      
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <UserTable users={users} onDelete={handleDeleteUser} />
      )}
    </>
  );
};

export default UserListScreen;
