import React, { useEffect, useState } from 'react';
import { Table, Button, Badge } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import Message from '../../components/Message';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/apiService';
import styles from './UserListScreen.module.css'; // Importar CSS Module

const UserListScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users');
      setUsers(data.data.users);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const deleteHandler = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers(); // Recargar la lista
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className={styles.title}>Usuarios</h1>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <Table striped bordered hover responsive className={`table-sm ${styles.userTable}`}>
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>NOMBRE</th>
              <th>EMAIL</th>
              <th>ROL</th>
              <th className={styles.actionsCell}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td title={user.id}>{user.customerNumber || user.id.substring(0, 10)}</td>
                <td>{user.firstName} {user.lastName}</td>
                <td><a href={`mailto:${user.email}`}>{user.email}</a></td>
                <td>
                    <Badge bg={user.role?.name === 'SUPER_ADMIN' ? 'danger' : 'primary'} className={styles.badge}>
                        {user.role?.name || 'USER'}
                    </Badge>
                </td>
                <td className={styles.actionsCell}>
                  <LinkContainer to={`/admin/user/${user.id}/edit`}>
                    <Button variant="light" className="btn-sm mx-1">
                      <i className="fas fa-edit"></i>
                    </Button>
                  </LinkContainer>
                  <Button
                    variant="danger"
                    className="btn-sm mx-1"
                    onClick={() => deleteHandler(user.id)}
                    disabled={user.role?.name === 'SUPER_ADMIN'}
                  >
                    <i className="fas fa-trash"></i>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
};

export default UserListScreen;
