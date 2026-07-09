import React, { useEffect, useState } from 'react';
import api from '../../services/apiService';

const SupportTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTickets = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/support/tickets');
      setTickets(data.data.tickets || []);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || 'No se pudieron cargar los tickets.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(() => {
      loadTickets({ silent: true });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const { data } = await api.put(`/support/tickets/${id}`, { status });
      setTickets(current => current.map(ticket => ticket.id === id ? data.data.ticket : ticket));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el estado del ticket.');
    }
  };

  return (
    <div>
      <h1>Soporte y tickets</h1>
      <p className="text-muted">Solicitudes escaladas desde web, correo, WhatsApp y bot.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      
      {loading ? (
        <div className="text-muted">Cargando tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-muted">Aún no hay tickets de soporte registrados.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Asunto</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id}>
                  <td>{ticket.ticketNumber}</td>
                  <td>
                    {ticket.name}
                    <br />
                    <small className="text-muted">{ticket.email}</small>
                  </td>
                  <td>{ticket.subject}</td>
                  <td>{ticket.source}</td>
                  <td>{ticket.status}</td>
                  <td>
                    <select 
                      className="form-select form-select-sm"
                      value={ticket.status} 
                      onChange={event => updateStatus(ticket.id, event.target.value)}
                    >
                      <option>OPEN</option>
                      <option>IN_PROGRESS</option>
                      <option>WAITING_CUSTOMER</option>
                      <option>RESOLVED</option>
                      <option>CLOSED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SupportTicketsScreen;
