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
npm run dist    # dist/LaGang-Setup-<versión>.exe
```

Se publica en `/srv/minecraft/skins/launcher/` (descarga: http://209.145.60.34:8090/launcher/LaGang-Setup.exe).

## Servidores y mods

El catálogo lo genera `catalogo/launcher_catalog.py` (copia en la VPS: `/root/mc-setup/launcher_catalog.py`).
Para agregar un servidor o cambiar mods: editar `SERVERS`, copiarlo a la VPS y correr `python3 /root/mc-setup/launcher_catalog.py`.
Los jugadores reciben los cambios la próxima vez que dan ENTRAR.

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
