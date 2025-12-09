import React from 'react';
import { Table, Button, Badge } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import styles from './RoleTable.module.css';

const RoleTable = ({ roles, onDelete }) => {
  return (
    <Table striped bordered hover responsive className={styles.roleTable}>
      <thead>
        <tr>
          <th>ID</th>
          <th>NOMBRE DEL ROL</th>
          <th>PERMISOS</th>
          <th>ACCIONES</th>
        </tr>
      </thead>
      <tbody>
        {roles.map((role) => (
          <tr key={role.id}>
            <td>{role.id}</td>
            <td>{role.name}</td>
            <td className={styles.permissionsCell}>
              {role.permissions?.map(permission => (
                <Badge pill bg="secondary" key={permission.id} className={styles.permissionBadge}>
                  {permission.name}
                </Badge>
              ))}
            </td>
            <td className={styles.actionsCell}>
              <LinkContainer to={`/admin/role/${role.id}/edit`}>
                <Button variant="light" className="btn-sm">
                  <i className="fas fa-edit"></i>
                </Button>
              </LinkContainer>
              <Button
                variant="danger"
                className="btn-sm"
                onClick={() => onDelete(role.id)}
                disabled={role.name === 'SUPER_ADMIN'}
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

export default RoleTable;