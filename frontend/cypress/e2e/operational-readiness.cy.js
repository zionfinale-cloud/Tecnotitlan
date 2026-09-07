/// <reference types="cypress" />

describe('Estado operativo', () => {
  it('muestra los controles pendientes sin desbordar la pantalla móvil', () => {
    cy.viewport(390, 844);
    cy.intercept('GET', '**/api/users/session', {
      status: 'success',
      data: { id: 'admin-1', name: 'Administración', email: 'admin@tecnotitlan.com.mx', role: 'SUPER_ADMIN', permissions: [], twoFactorEnabled: true },
    });
    cy.intercept('GET', '**/api/settings/public', { status: 'success', data: [] });
    cy.intercept('GET', '**/api/security/status', { status: 'success', data: { twoFactorEnabled: true, recoveryCodesRemaining: 8 } });
    cy.intercept('GET', '**/api/security/activity', { status: 'success', data: { logs: [] } });
    cy.intercept('GET', '**/api/audit-logs?days=30&limit=100', { status: 'success', data: { logs: [] } });
    cy.intercept('GET', '**/api/security/readiness', {
      status: 'success',
      data: { score: 86, readyCount: 6, total: 7, checks: [{ id: 'whatsapp', label: 'WhatsApp operativo', ready: false, detail: 'Falta sesión activa o grupo administrativo', action: '/admin/settings/whatsapp' }] },
    });
    cy.intercept('GET', '**/api/integrations/whatsapp/chats', { status: 'success', data: [] });
    cy.intercept('GET', '**/api/mercadolibre/communications/counts', { status: 'success', data: { total: 0 } });
    cy.intercept('GET', '**/api/unified-inbox/counts', { status: 'success', data: { total: 0 } });
    cy.intercept('GET', '**/api/unified-inbox/critical-alerts', { status: 'success', data: { alerts: [] } });

    cy.visit('/admin/security');
    cy.contains('Estado operativo').should('be.visible');
    cy.contains('86% listo').should('be.visible');
    cy.contains('WhatsApp operativo').should('be.visible');
    cy.contains('button', 'Corregir').should('be.visible');
    cy.document().then((document) => expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth));
  });
});
