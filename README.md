# La Gang Launcher

- `app/`: el launcher (Electron + XMCL). Cómo correrlo y compilarlo en [app/README.md](app/README.md).
- `catalogo/launcher_catalog.py` y `servidores.json`: generan el catálogo de servidores y mods que lee el launcher, detectando los contenedores de Docker de la VPS (en `/root/mc-setup/`, cron cada 5 minutos).
- [docs/operacion.md](docs/operacion.md): VPS, catálogo, actualizaciones del launcher y cuentas de Microsoft.
- [CHANGELOG.md](CHANGELOG.md): qué trae cada versión.
