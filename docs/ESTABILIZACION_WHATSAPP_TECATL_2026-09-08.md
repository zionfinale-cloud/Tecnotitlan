# Estabilización de WhatsApp / Técatl

Fecha de auditoría: 2026-09-08. La revisión y las pruebas se realizaron sin QR, sin vinculación, sin `logout()` y sin envíos reales.

## Decisión

Se eligió la estrategia **A: conservar `@whiskeysockets/baileys` 7.0.0-rc13 fijado exactamente y endurecer la integración local**.

- Instalado y fijado: `7.0.0-rc13`, commit de etiqueta `a3eeccd55c763a478424d296baa640840e54bf76`.
- `rc14`: `dbede1fb64c774e4f9a2e93a44221c4139973f52`.
- `master` revisado: `0af2386292907f7d9742d8d41f830d8c48208fa1`.
- PR 2748: `8112bf34b5d80e9bb1426dc82d27c64d7109484d`, abierta.
- PR 2752: `6194870aef34aeb595dae38823d49e2645e3a261`, abierta.
- PR 2765: `4f263f0e365c2e74dd1b824031d1c5910f518c26`, abierta.

`rc14` no incorpora las PR 2748, 2752 ni 2765. `master` tampoco las incorpora. Mezclarlas localmente agregaría cambios de protocolo y emparejamiento todavía no liberados; por eso no se hizo un backport especulativo.

## Matriz de riesgos y controles

| Riesgo | Evidencia upstream | Control aplicado |
|---|---|---|
| Envío PN que falla y LID que funciona | Issues 2683, 2698; PR 2748 | Se consulta primero el mapeo PN→LID persistido. Un LID entrante se conserva sin transformarlo. |
| `onWhatsApp()` devuelve `exists:false` o falla | Riesgo de envío a identidad no verificada | Cero envíos en ambos casos. No existe fallback ni segundo intento. |
| 463 síncrono o asíncrono | Issues 2441, 2636, 2707 | Clasificación estructurada; circuito `PAUSED`; no retry, no QR, no `logout()` y el socket permanece abierto sólo para recepción. |
| 408 infinito por versión obsoleta | Issue 2777 | Caché inmutable por proceso; sólo se acepta `isLatest=true`; último valor bueno persistido; luego default incluido. Tras el único reintento permitido se pausa. |
| 428/pairing loop | Issues 2737, 2770 | 428 es protegido y no transitorio. No se usa `requestPairingCode`; QR sólo por acción manual existente. |
| 515/restart required | Comportamiento del socket | Un único reinicio controlado, sin borrar credenciales; después pausa. |
| Doble socket y carrera de sesión | Issues 2707, 2770 | Promesa de inicialización única, lock con heartbeat, identidad de socket y cierre ordenado existentes y conservados. |
| Fan-out administrativo | Riesgo operativo observado | Baileys envía una sola vez a `WHATSAPP_ADMIN_GROUP_JID`. Técatl y pagos administrativos usan el mismo gateway. |
| Estado de entrega opaco | `messages.update` puede llegar después del send | Se guardan `operationId`, ID del proveedor, identidad solicitada/resuelta, tipo PN/LID, código, conexión y timestamps. |
| Fuga de sesión/PII | Política de seguridad de Baileys | Auth cifrado AES-256-GCM en PostgreSQL, logger Baileys silencioso y Sentry sin PII/contenido de solicitudes. |

## Tokens y protocolo

- TC token: `rc13` ya contiene almacenamiento y uso reactivo, y el key store genérico de Tecnotitlán persiste `tctoken` y mapeos LID cifrados. La captura proactiva de la PR 2752 sigue abierta y no se incorporó sin una liberación upstream.
- CS token: sólo se encontró una propuesta abierta e incompleta (PR 2438). No se inventó ni almacenó un token no verificado.
- `companion_reg_refresh`: la corrección está en la PR 2765 abierta. Como Tecnotitlán no usa pairing code y el trabajo prohibía emparejar una cuenta real, no se modificó el protocolo de QR.

## Pruebas y despliegue seguro

La suite incluye pruebas con socket simulado para PN→LID, LID inmutable, `exists:false`, error de lookup, texto de un solo envío, multimedia de un solo envío y rechazo sin retry; además cubre versiones y códigos 401/405/408/428/463/500/515. La suite global debe quedar verde antes de desplegar.

Para producción:

1. Crear dos proyectos Sentry (Node y React) y completar `SENTRY_DSN` y `REACT_APP_SENTRY_DSN`.
2. Confirmar `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_AUTH_STORAGE=database` y un solo `WHATSAPP_ADMIN_GROUP_JID`.
3. Ejecutar `npx prisma migrate deploy` antes de levantar la nueva API.
4. Hacer despliegue sin resetear sesión. No solicitar QR salvo decisión manual y ventana de mantenimiento.

## Fuentes upstream

- [Seguridad y versiones soportadas de Baileys](https://github.com/WhiskeySockets/Baileys/security)
- [GHSA-qvv5-jq5g-4cgg](https://github.com/advisories/GHSA-qvv5-jq5g-4cgg): afecta RC anteriores a rc12; rc13 no está afectado.
- Issues: [2441](https://github.com/WhiskeySockets/Baileys/issues/2441), [2636](https://github.com/WhiskeySockets/Baileys/issues/2636), [2683](https://github.com/WhiskeySockets/Baileys/issues/2683), [2688](https://github.com/WhiskeySockets/Baileys/issues/2688), [2691](https://github.com/WhiskeySockets/Baileys/issues/2691), [2698](https://github.com/WhiskeySockets/Baileys/issues/2698), [2707](https://github.com/WhiskeySockets/Baileys/issues/2707), [2737](https://github.com/WhiskeySockets/Baileys/issues/2737), [2770](https://github.com/WhiskeySockets/Baileys/issues/2770), [2777](https://github.com/WhiskeySockets/Baileys/issues/2777).
- PRs: [2438](https://github.com/WhiskeySockets/Baileys/pull/2438), [2748](https://github.com/WhiskeySockets/Baileys/pull/2748), [2752](https://github.com/WhiskeySockets/Baileys/pull/2752), [2765](https://github.com/WhiskeySockets/Baileys/pull/2765).
