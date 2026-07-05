# Tecnotitlan Security Baseline Policy

Effective date: 2026-07-05

## Purpose

Tecnotitlan maintains a basic operational security baseline to protect customer data, order data, payment metadata, internal systems, and marketplace integrations.

## Daily Operational Controls

- Administrative access is limited to authorized Tecnotitlan staff.
- Staff devices used to access administrative systems must use operating system account protection and screen lock.
- Passwords must not be shared between staff members.
- Production credentials, API keys, database URLs, and SMTP credentials must be stored only in server-side environment or protected configuration settings.
- Sensitive credentials must not be stored in public frontend code or shared in public repositories.
- Administrative users should use strong passwords and enable multi-factor authentication where supported by the service provider.
- Staff should avoid leaving customer or order data visible on unattended screens.
- Customer information should only be accessed when needed to process orders, support requests, returns, refunds, or marketplace operations.

## Review

This baseline is reviewed when operational processes change or when new integrations are added.

