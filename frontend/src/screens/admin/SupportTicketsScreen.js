import React, { useEffect, useState } from 'react';
import api from '../../services/apiService';

const SupportTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/support/tickets').then(({ data }) => setTickets(data.data.tickets)).catch(err => setError(err.response?.data?.message || 'No se pudieron cargar los tickets.')); }, []);
  const updateStatus = async (id, status) => {
    const { data } = await api.put(`/support/tickets/${id}`, { status });
    setTickets(current => current.map(ticket => ticket.id === id ? data.data.ticket : ticket));
  };
  return (
    <div><h1>Soporte y tickets</h1><p className="text-muted">Solicitudes escaladas desde web, correo, WhatsApp y bot.</p>{error && <div className="alert alert-danger">{error}</div>}
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Folio</th><th>Cliente</th><th>Asunto</th><th>Origen</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{tickets.map(ticket => <tr key={ticket.id}><td>{ticket.ticketNumber}</td><td>{ticket.name}<br /><small>{ticket.email}</small></td><td>{ticket.subject}</td><td>{ticket.source}</td><td>{ticket.status}</td><td><select value={ticket.status} onChange={event => updateStatus(ticket.id, event.target.value)}><option>OPEN</option><option>IN_PROGRESS</option><option>WAITING_CUSTOMER</option><option>RESOLVED</option><option>CLOSED</option></select></td></tr>)}</tbody>
      </table></div>
    </div>
  );
};
export default SupportTicketsScreen;
