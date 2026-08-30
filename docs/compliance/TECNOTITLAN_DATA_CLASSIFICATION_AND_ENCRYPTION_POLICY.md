# Tecnotitlan Data Classification and Encryption Policy

Effective date: 2026-07-05

## Purpose

Tecnotitlan classifies and protects data based on sensitivity and business need.

## Data Classification

### Public

Product catalog data, public pricing, public images, public store content, and published legal pages.

### Internal

Operational notes, inventory records, margin calculations, investment records, marketplace synchronization status, and internal dashboards.

### Confidential

Customer names, emails, phone numbers, addresses, order information, payment metadata, support messages, API credentials, SMTP credentials, database URLs, and marketplace tokens.

## Protection Requirements

- Confidential data must only be accessible to authorized users.
- Secrets must be stored in server-side environment variables or protected configuration storage.
- Marketplace access and refresh tokens must be encrypted at rest with authenticated encryption. Decryption keys must remain server-side and must not be committed or exposed to the browser.
- Recovery codes must be stored as one-way hashes. TOTP seeds must be encrypted at rest.
- Encryption-key changes require an explicit rotation procedure; replacing a key without re-encryption can make protected integrations unavailable.
- Payment card data is processed through payment providers such as Stripe. Tecnotitlan does not store raw card numbers.
- Production traffic must use HTTPS.
- Database connections must use provider-supported encrypted connections where available.
- Database access restrictions should be enabled where supported by the database provider.

## Retention

Customer and order data should be retained only for business, legal, tax, support, fulfillment, and marketplace operation needs.
