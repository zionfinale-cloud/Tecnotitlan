/// <reference types="cypress" />

describe('Dashboard administrativo adaptable', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users/session', {
      status: 'success',
      data: { id: 'admin-1', name: 'Administración', email: 'admin@tecnotitlan.com.mx', role: 'SUPER_ADMIN', permissions: [], twoFactorEnabled: true },
    });
    cy.intercept('GET', '**/api/settings/public', { status: 'success', data: [] });
    cy.intercept('GET', '**/api/integrations/whatsapp/chats', { status: 'success', data: [] });
    cy.intercept('GET', '**/api/mercadolibre/communications/counts', { status: 'success', data: { total: 0 } });
    cy.intercept('GET', '**/api/unified-inbox/counts', { status: 'success', data: { total: 1 } });
    cy.intercept('GET', '**/api/service-quality/dashboard', { status: 'success', data: { summary: { compliance: 93, breached: 0 } } });
    cy.intercept('GET', '**/api/analytics/dashboard?days=30', {
      status: 'success',
      data: { summary: { views: 23, viewsToday: 7, visitors: 12, pagesPerVisitor: 1.9 }, topPages: [], sources: [], countries: [], referrers: [], daily: [] },
    });
    cy.intercept('GET', '**/api/unified-inbox/critical-alerts', {
      status: 'success',
      data: {
        alerts: [{
          id: 'refund-1', claimId: 'claim-1', kind: 'REFUND', title: 'Reembolso confirmado', orderNumber: 'MELI-2000018155463682',
          message: 'Mercado Libre cerró el reclamo a favor del comprador por decisión de cobertura. El pedido quedó cancelado y el reembolso fue confirmado.',
          reconciliation: { refundAmount: 1070.75, commissionAtRisk: 155.26, shippingAtRisk: 103, inventoryCostAtRisk: 350, estimatedExposure: 608.26, inventoryStatus: 'PENDING_REVIEW', restockedQuantity: 0, soldQuantity: 1 },
        }],
        assignees: [
          { id: 'seller-1', firstName: 'Gabriel', lastName: 'Fernández', role: { name: 'VENDEDOR' } },
          { id: 'admin-1', firstName: 'Administración', role: { name: 'SUPER_ADMIN' } },
        ],
        metrics: { claims30d: 1, refunds30d: 1, refundAmount30d: 1070.75, unassigned: 1, escalated: 1 },
        notificationHealth: { whatsapp: { connected: false, hasSavedSession: false } },
      },
    });
  });

  const expectNoHorizontalPageOverflow = () => cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
  });

  it('conserva todas las métricas y acciones dentro de una laptop', () => {
    cy.viewport(1366, 768);
    cy.visit('/admin/dashboard');
    cy.contains('h1', 'Dashboard de administración').should('be.visible');
    cy.contains('Reembolso confirmado').should('be.visible');
    cy.contains('Escalados').should('be.visible');
    cy.contains('Calidad').should('be.visible');
    expectNoHorizontalPageOverflow();
  });

  it('apila el incidente y conserva sus controles en un teléfono', () => {
    cy.viewport(390, 844);
    cy.visit('/admin/dashboard');
    cy.contains('Reembolso confirmado').should('be.visible');
    cy.contains('label', 'Responsable').find('select').should('be.visible');
    cy.contains('button', 'Asignar caso').should('be.visible');
    expectNoHorizontalPageOverflow();
  });
});
