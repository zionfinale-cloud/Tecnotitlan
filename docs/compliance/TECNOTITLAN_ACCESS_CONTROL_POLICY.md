# Tecnotitlan Access Control Policy

Effective date: 2026-07-05

## Purpose

This policy defines how Tecnotitlan restricts access to systems and personal data using role-based access and the principle of least privilege.

## Access Principles

- Access is granted only to authorized users with a business need.
- Administrative functionality is protected by authentication and role-based permissions.
- Super Admin access is restricted to trusted administrators.
- Administrative users should enable time-based one-time password (TOTP) authentication and keep recovery codes in a separate secure location.
- Seller, support, and operational staff should only receive the permissions needed for their role.
- Secrets and sensitive configuration values are available only to authorized administrators.
- Public users must not have access to administrative dashboards, internal settings, or private operational data.

## Access Reviews

User permissions should be reviewed when staff responsibilities change, when a staff member leaves the organization, or when a new sensitive module is added.

## Revocation

Access must be removed when a user no longer needs it or when there is a suspected security issue.
Password and second-factor changes must invalidate previously issued sessions. Sensitive mutations must leave an audit event without reproducing request secrets.
