# Copias de seguridad de PostgreSQL

El temporizador crea diariamente un `pg_dump` cifrado con AES-256, verifica que
`pg_restore` pueda leerlo y conserva 14 días. Los archivos y claves son `root:root`
con permisos `0600`/`0700`.

Archivos privados del servidor, nunca del repositorio:

- `/etc/tecnotitlan/backup.env`: `DATABASE_URL=postgresql://...`
- `/etc/tecnotitlan/backup.key`: clave aleatoria de cifrado

Una copia local no sustituye una copia fuera del VPS. Replica periódicamente los
archivos `.dump.enc`, su `.sha256` y la clave en una bóveda externa separada.

Para comprobar el temporizador:

```bash
systemctl status tecnotitlan-backup.timer
journalctl -u tecnotitlan-backup.service --since today
```
