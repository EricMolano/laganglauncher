# Operación del launcher

Cómo está montado todo lo que el launcher necesita fuera del código: la VPS, el catálogo de servidores,
las actualizaciones del propio launcher y las cuentas de Microsoft.

## Panorama

```
VPS (209.145.60.34)                                        PC del jugador
┌──────────────────────────────────────────────┐          ┌───────────────────────────┐
│ contenedores itzg: mc (LA GANG), lucky        │          │ Launcher La Gang           │
│        │ docker inspect + /data/.*-manifest   │          │  1. baja catalog.json      │
│        ▼                                      │  HTTP    │  2. una pestaña por        │
│ cron */5 → launcher_catalog.py ───────────────┼────────► │     servidor               │
│   + servidores.json (textos)                  │  :8090   │  3. ENTRAR: Java, MC,      │
│        ▼                                      │          │     loader y mods          │
│ /srv/minecraft/skins/launcher/v1 (mc-skins)   │          └─────────────┬─────────────┘
└──────────────────────────────────────────────┘                        │ HTTPS
                                       GitHub Releases ◄────────────────┘ busca versiones nuevas
```

## Acceso a la VPS

- Usuario `root` **solo con llave**: la VPS rechaza la contraseña de root aunque se cambie en Contabo.
- La llave de este equipo es `~/.ssh/minecraft_vps` (regenerada el 2026-11-20).
- Si se pierde la llave: en el panel de Contabo, *Reset credentials* → pestaña **SSH-Key** → pegar la llave pública nueva.
  - Agrega la llave a `/root/.ssh/authorized_keys` sin borrar las demás (comprobado el 2026-11-20).
  - **Reinicia la VPS.** Los contenedores vuelven solos, pero cuenta como reinicio de los servidores.
  - No usar *Reinstall*: borra el disco.
- La llave de despliegue de MacTienda está en el usuario `deploy` (forced command), no en `root`.

## Catálogo de servidores (detección automática)

`catalogo/launcher_catalog.py` (en la VPS: `/root/mc-setup/launcher_catalog.py`) publica la lista de servidores y
los manifiestos de mods en `/srv/minecraft/skins/launcher/v1`, que sirve el contenedor `mc-skins` en el puerto 8090.

### Qué detecta solo

Recorre todos los contenedores de Docker y toma los de Minecraft (imagen `itzg/minecraft-server` o puerto 25565 expuesto).

| Dato | De dónde sale |
|------|---------------|
| Puerto | `SERVER_PORT` si el contenedor usa red `host` (25565 si no está); si no, el puerto publicado |
| Versión de Minecraft | `VERSION` (si es `LATEST` o falta, el contenedor se omite) |
| Loader | `TYPE`: `FABRIC`, `FORGE`. `PAPER`, `SPIGOT`, `PURPUR`, `BUKKIT`, `FOLIA` entran como vanilla sin mods |
| Versión del loader | La que itzg instaló de verdad: `/data/.fabric-manifest.json` o `/data/.forge-manifest.json`; si no existen, `FABRIC_LOADER_VERSION` / `FORGE_VERSION` |
| Java | Según la versión: 1.20.5+ → 21, 1.18–1.20.4 → 17, antes → 8 |
| Mods | La carpeta `/data/mods` montada en el host |
| Encendido | Estado del contenedor (`running`); el launcher atenúa los apagados |

La memoria **no** se toma del contenedor: `MAX_MEMORY` es la del servidor (14 GB en LA GANG), no la del PC del jugador.
Por defecto se recomiendan 4 GB.

### servidores.json

Lo que Docker no sabe va en `/root/mc-setup/servidores.json`, con el **nombre del contenedor** como clave.
Cualquier campo gana sobre lo detectado. El orden del archivo es el orden de las pestañas (los encendidos van primero).

| Campo | Uso |
|-------|-----|
| `id` | Identificador estable (carpeta de la instancia en el PC del jugador). No cambiarlo después de publicado |
| `name` | Texto de la pestaña |
| `kicker`, `headline`, `quote` | Textos grandes de la portada |
| `scene` | Escena animada: `gang` o `lucky` (están en `app/src/renderer/scenes.js`) |
| `memory` | `{"min": MB, "recommended": MB}` para el jugador |
| `sources` | `{"mods": [carpetas o .jar]}` cuando los mods del cliente no son los de `/data/mods` (LA GANG usa `/root/modpack/jars` + `/root/modpack/cliente`) |
| `hidden` | `true` para no publicar ese contenedor |

Un servidor nuevo **no necesita entrada**: aparece con el nombre del contenedor, escena `gang` y sus mods de `/data/mods`.

### Cron

```cron
*/5 * * * * python3 /root/mc-setup/launcher_catalog.py >> /var/log/launcher_catalog.log 2>&1
```

- Cada pasada tarda ~1,2 s y solo reescribe `catalog.json` si algo cambió.
- A mano: `python3 /root/mc-setup/launcher_catalog.py`.
- Si un contenedor se omite, el motivo queda en `/var/log/launcher_catalog.log` (`omitido …`).
- Respaldo de la versión anterior del script y del catálogo: `/root/mc-setup/*.antes-202611201203`.

### Ojo con los reinicios

Si un contenedor no fija la versión del loader, itzg instala la última al arrancar.
El 2026-11-20, tras reiniciar la VPS, LA GANG pasó de Fabric 0.19.5 a 0.20.1.
Como el catálogo lee la versión instalada, el launcher sigue al servidor solo; pero un cambio de loader puede romper mods.
Para fijarla: `FABRIC_LOADER_VERSION` / `FORGE_VERSION` en el `docker-compose.yml` del servidor.

## Actualizaciones del launcher

Desde la 0.2.0 el launcher usa `electron-updater` con GitHub Releases (`EricMolano/laganglauncher`, por HTTPS).
No se sirve desde la VPS porque va por HTTP: cualquiera en la red podría cambiar el instalador.

- Busca al abrir y cada hora; descarga en segundo plano.
- Arriba muestra "Descargando versión X · N%" y luego "Versión X lista · Reiniciar".
- Si el jugador no reinicia, se instala al cerrar el launcher. Con Minecraft abierto no reinicia.
- Sin release o sin internet no muestra nada y sigue normal.

### Sacar una versión

1. Subir `version` en `app/package.json` (solo se actualiza a una versión mayor).
2. Token de GitHub *fine-grained* con permiso **Contents: read and write** sobre el repo.
3. Desde `app/`: `GH_TOKEN=<token> npm run release` (compila y publica el `.exe`, `latest.yml` y `.blockmap`).
4. Copiar el `.exe` a `/srv/minecraft/skins/launcher/` y apuntar el enlace `LaGang-Setup.exe` a él, para las instalaciones nuevas.

Los jugadores con 0.1.x **no** se actualizan solos: tienen que instalar la 0.2.0 a mano una vez.

## Cuentas

Las cuentas son del launcher, no de cada servidor: se guardan una vez en `settings.json` y ENTRAR usa la marcada en cualquier servidor.

### Microsoft (Minecraft original)

| Dato | Valor |
|------|-------|
| Registro | Azure, directorio propio "Default Directory" (cuenta personal), app "La Gang Launcher" |
| Tipo de cuenta | Solo cuentas personales de Microsoft |
| Redirect | Cliente público/nativo: `https://login.microsoftonline.com/common/oauth2/nativeclient` |
| Client ID | `bae83554-dcba-42c8-94be-83eac56df569` (en `app/src/main/config.js`; no es secreto) |
| Tenant ID | `7408734d-c9e6-4eb9-9b9a-60f205f01d1e` |
| Flujo | Código de autorización con PKCE, scope `XboxLive.signin offline_access`; sin secreto de cliente |

- Desde junio de 2024 Microsoft exige registrar las apps dentro de un directorio: una cuenta personal sin directorio
  da el error "la cuenta no existe en el inquilino Microsoft Services". Se resolvió creando la cuenta de Azure (prueba gratuita),
  que crea el directorio propio; registrar la app no cuesta.
- **Pendiente: aprobación de Mojang** (formulario https://aka.ms/mce-reviewappid, solicitada el 2026-11-20 con el client ID y tenant ID de arriba).
  Hasta que aprueben, el paso de Minecraft responde 403 y el launcher muestra "Mojang todavía no aprobó este launcher…".
  No hay plazo oficial; si en un mes no responden, se puede reenviar.
- El launcher también permite cuentas sin premium; Mojang podría objetarlo en la revisión.

### Mientras tanto

Los servidores están en modo sin premium: un jugador premium entra con una cuenta sin premium usando **su mismo nombre**
y conserva su inventario (el UUID sale del nombre). Solo pierde la skin oficial.
