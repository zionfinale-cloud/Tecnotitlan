import React from 'react';
import { Table, Button } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import styles from './UserTable.module.css'; // Usaremos un CSS module para estilos

const UserTable = ({ users, onDelete }) => {
  return (
    <Table striped bordered hover responsive className={styles.userTable}>
      <thead>
        <tr>
          <th>ID</th>
          <th>NOMBRE</th>
          <th>EMAIL</th>
          <th>ROL</th>
          <th>ADMIN</th>
          <th>ACCIONES</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.id}</td>
            <td>{user.name}</td>
            <td><a href={`mailto:${user.email}`}>{user.email}</a></td>
            <td>{user.role?.name || 'Sin Rol'}</td>
            <td className={styles.statusCell}>
              {user.isAdmin ? (
                <i className="fas fa-check" style={{ color: 'green' }}></i>
              ) : (
                <i className="fas fa-times" style={{ color: 'red' }}></i>
              )}
            </td>
            <td className={styles.actionsCell}>
              <LinkContainer to={`/admin/user/${user.id}/edit`}>
                <Button variant="light" className="btn-sm">
                  <i className="fas fa-edit"></i>
                </Button>
              </LinkContainer>
              <Button
                variant="danger"
                className="btn-sm"
                onClick={() => onDelete(user.id)}
              >
                <i className="fas fa-trash"></i>
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default UserTable;