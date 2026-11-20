# Launcher de La Gang

Electron + XMCL. Login sin premium, catálogo propio en la VPS, instala Java, Minecraft, Fabric/Forge y los mods, y entra directo al servidor.

## Desarrollo

```bash
npm install
node node_modules/electron/install.js   # npm 11 no corre el script de Electron por sí solo
npm start
```

Pruebas sin interfaz: `electron test/smoke.js lucky [--launch]`. Capturas de la interfaz: `electron test/ui.js <carpeta> "<js>@@<ms>|||..."`.
Revisar qué quedó dentro del instalador: `node test/asar-check.js` (después de `npm run dist`).

## Instalador

```bash
npm run dist    # dist/LaGang-Setup-<versión>.exe, sin publicar
```

La primera instalación se descarga de http://209.145.60.34:8090/launcher/LaGang-Setup.exe (copiar el `.exe` a `/srv/minecraft/skins/launcher/` y apuntar el enlace `LaGang-Setup.exe` a él).

## Actualizaciones del launcher

Desde la 0.2.0 el launcher se actualiza solo desde los *releases* de GitHub (`EricMolano/laganglauncher`, por HTTPS):
busca al abrir y cada hora, descarga en segundo plano y muestra arriba "Versión X lista · Reiniciar".
Si el jugador no reinicia, se instala al cerrar el launcher. Con Minecraft abierto no reinicia.

Para sacar una versión:

1. Subir `version` en `package.json` (los jugadores solo actualizan si es mayor).
2. Crear un token de GitHub con permiso *Contents: read and write* sobre el repo.
3. `GH_TOKEN=<token> npm run release`: compila y publica el release con el `.exe`, `latest.yml` y el `.blockmap`.
4. Copiar también el `.exe` a la VPS para que la descarga directa sea la última.

Sin release publicado (o sin internet) el launcher sigue normal; el error de búsqueda no se muestra.

## Servidores y mods

El catálogo lo genera `catalogo/launcher_catalog.py` en la VPS (`/root/mc-setup/`), que **detecta los servidores de Docker**:
cada contenedor de Minecraft (imagen `itzg/minecraft-server` o con el puerto 25565 expuesto) aparece en el launcher.

- De Docker saca el puerto publicado, `VERSION`, `TYPE` (`FABRIC`, `FORGE`; `PAPER`/`SPIGOT`/`PURPUR` entran como vanilla sin mods), la versión del loader, `MEMORY` y los mods de la carpeta `/data/mods` montada.
- Lo que Docker no sabe (nombre, frase, escena, mods solo de cliente) va en `catalogo/servidores.json`, con el nombre del contenedor como clave. Lo que esté ahí gana sobre lo detectado; `"hidden": true` oculta un contenedor.
- Un contenedor sin `VERSION` fija o sin puerto publicado se omite, salvo que tenga entrada en `servidores.json`.
- Los apagados salen en el catálogo con `running: false` y el launcher los muestra atenuados.

Cron lo corre cada 5 minutos y solo reescribe `catalog.json` si algo cambió:

```cron
*/5 * * * * python3 /root/mc-setup/launcher_catalog.py >> /var/log/launcher_catalog.log 2>&1
```

Los jugadores reciben los cambios la próxima vez que abren el launcher o dan ENTRAR.

Cada servidor elige su escena con `scene` (`gang`, `lucky`); las escenas están en `src/renderer/scenes.js`.

## Cuentas

El launcher guarda varias cuentas (botón de la cuenta, abajo a la izquierda) y usa la marcada al dar ENTRAR.

- **Sin premium**: solo un nombre. El UUID es el mismo que calcula un servidor en modo offline.
- **Microsoft** (Minecraft original): el jugador inicia sesión en la página de Microsoft; el launcher nunca ve la contraseña. Solo se guarda el token de renovación, cifrado por Windows, en `settings.json`.

### Cuenta de Microsoft: configuración (una sola vez)

1. En https://portal.azure.com → *App registrations* → *New registration*. Tipo de cuenta: **Personal Microsoft accounts only**.
2. En *Authentication* → *Add a platform* → *Mobile and desktop applications* y marcar `https://login.microsoftonline.com/common/oauth2/nativeclient`.
3. Copiar el *Application (client) ID* a `src/main/config.js` (`msClientId`). Para probar sin editar el archivo: variable `LAGANG_MS_CLIENT_ID`.
4. Pedir a Mojang que apruebe la aplicación: https://aka.ms/mce-reviewappid. Hasta que la aprueben, el paso de Minecraft responde 403 y el launcher lo avisa.

## Notas

- XMCL 6.3.x llega mal publicado (dependencias `workspace:`); se usa 6.1.2 con `undici` 6 forzado en `overrides`.
- Las descargas de Mojang van por un `Agent` de undici limitado a 12 conexiones; sin eso Mojang corta.
- Datos del juego en `%APPDATA%\.lagang-launcher` (compartido en `shared/`, cada servidor en `instances/<id>`).
