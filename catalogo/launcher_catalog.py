#!/usr/bin/env python3
"""Genera el catalogo del launcher de La Gang detectando los servidores de Docker.

Cada contenedor de Minecraft (imagen itzg/minecraft-server o con el puerto 25565
expuesto) aparece en el launcher. De Docker se lee lo tecnico:
  puerto publicado, VERSION, TYPE (FABRIC/FORGE), FABRIC_LOADER_VERSION, FORGE_VERSION,
  MEMORY y la carpeta /data montada en el host (sus mods/ son los que baja el cliente).

Lo que Docker no sabe (nombre bonito, frase, escena, mods solo de cliente) va en
servidores.json, junto a este script, con el nombre del contenedor como clave:

  {"mc": {"id": "gang", "name": "La Gang · Historia", "scene": "gang",
          "sources": {"mods": ["/root/modpack/jars", "/root/modpack/cliente"]}}}

Cualquier campo de servidores.json gana sobre lo detectado. Un servidor nuevo sin
entrada sale igual, con el nombre del contenedor y la escena por defecto.
Con "hidden": true un contenedor no se publica.

Publica en /srv/minecraft/skins/launcher/v1 (servido por mc-skins en :8090):
  catalog.json             lista de servidores
  <id>/manifest.json       archivos que necesita el cliente de ese servidor
  files/<sha1[:2]>/<sha1>  contenido (enlaces duros a los jars originales)

Lo corre cron cada 5 minutos; a mano: python3 /root/mc-setup/launcher_catalog.py
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

OUT = Path("/srv/minecraft/skins/launcher/v1")
BASE_URL = "http://209.145.60.34:8090/launcher/v1"
HOST = "209.145.60.34"
OVERRIDES = Path(__file__).resolve().parent / "servidores.json"
DEFAULT_SCENE = "gang"
PLUGIN_SERVERS = {"PAPER", "SPIGOT", "BUKKIT", "PURPUR", "FOLIA"}


def docker(*args):
    return subprocess.run(["docker", *args], check=True, capture_output=True, text=True).stdout


def env_of(info):
    return dict(item.split("=", 1) for item in info["Config"].get("Env") or [] if "=" in item)


def is_minecraft(info):
    image = info["Config"].get("Image", "")
    exposed = info["Config"].get("ExposedPorts") or {}
    return "minecraft-server" in image or "25565/tcp" in exposed


def published_port(info):
    for b in (info["HostConfig"].get("PortBindings") or {}).get("25565/tcp") or []:
        if b.get("HostPort"):
            return int(b["HostPort"])
    return None


def data_dir(info):
    for m in info.get("Mounts") or []:
        if m.get("Destination") == "/data":
            return Path(m["Source"])
    return None


def java_for(minecraft):
    # Mojang: 1.20.5+ pide Java 21, 1.18-1.20.4 Java 17, antes Java 8.
    minor, patch = ([int(x) for x in re.findall(r"\d+", minecraft)[1:3]] + [0, 0])[:2]
    if (minor, patch) >= (20, 5):
        return 21
    return 17 if minor >= 18 else 8


def memory_mb(value):
    m = re.fullmatch(r"(\d+)([GgMm])?", value or "")
    if not m:
        return None
    n = int(m.group(1))
    return n * 1024 if (m.group(2) or "M").upper() == "G" else n


def detect(info):
    """Lo que se saca del contenedor, o (None, motivo) si no alcanza para jugar."""
    env = env_of(info)
    name = info["Name"].lstrip("/")
    minecraft = env.get("VERSION")
    kind = env.get("TYPE", "VANILLA").upper()
    port = published_port(info)
    if not minecraft or minecraft.upper() == "LATEST" or not port:
        return None, f"{name}: falta VERSION fija o puerto publicado"
    server = {
        "id": re.sub(r"[^a-z0-9-]", "-", name.lower()),
        "name": name,
        "scene": DEFAULT_SCENE,
        "host": HOST,
        "port": port,
        "minecraft": minecraft,
        "java": java_for(minecraft),
    }
    data = data_dir(info)
    if kind == "FABRIC":
        server["loader"] = {"type": "fabric", "version": env.get("FABRIC_LOADER_VERSION")}
    elif kind == "FORGE":
        server["loader"] = {"type": "forge", "version": env.get("FORGE_VERSION")}
    elif kind in PLUGIN_SERVERS:
        # Los plugins viven solo en el servidor: el cliente entra con Minecraft sin mods.
        data = None
    elif kind != "VANILLA":
        return None, f"{name}: TYPE={kind} no soportado por el launcher"
    if "loader" in server and not server["loader"]["version"]:
        return None, f"{name}: TYPE={kind} sin version del loader"
    mem = memory_mb(env.get("MEMORY") or env.get("MAX_MEMORY"))
    if mem:
        server["memory"] = {"min": min(mem, 4096), "recommended": mem}
    server["sources"] = {"mods": [str(data / "mods")] if data else []}
    return server, None


def discover(overrides):
    ids = docker("ps", "-aq").split()
    found = []
    for info in json.loads(docker("inspect", *ids)) if ids else []:
        if not is_minecraft(info):
            continue
        container = info["Name"].lstrip("/")
        extra = overrides.get(container, {})
        if extra.get("hidden"):
            continue
        server, problem = detect(info)
        # Con entrada en servidores.json se publica aunque falten datos en Docker (la entrada los pone).
        if problem and not extra:
            print(f"omitido {problem}", file=sys.stderr)
            continue
        server = {**(server or {}), **extra, "running": info["State"].get("Running", False)}
        found.append((container, server))
    # Primero los encendidos; luego el orden de servidores.json y el nombre.
    order = {name: i for i, name in enumerate(overrides)}
    found.sort(key=lambda cs: (not cs[1]["running"], order.get(cs[0], len(order)), cs[1]["name"]))
    return [server for _, server in found]


def sha1_of(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def iter_sources(sources):
    for src in sources:
        p = Path(src)
        if p.is_file():
            yield p
        elif p.is_dir():
            yield from sorted(x for x in p.iterdir() if x.is_file() and x.suffix == ".jar")


def publish(src, digest):
    dest = OUT / "files" / digest[:2] / digest
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(src, dest)
        except OSError:
            dest.write_bytes(Path(src).read_bytes())
        os.chmod(dest, 0o644)
    return f"{BASE_URL}/files/{digest[:2]}/{digest}"


def build_server(server):
    files = []
    for folder, sources in server.pop("sources", {}).items():
        for src in iter_sources(sources):
            digest = sha1_of(src)
            files.append({
                "path": f"{folder}/{src.name}",
                "sha1": digest,
                "size": src.stat().st_size,
                "url": publish(src, digest),
            })
    manifest = {
        "id": server["id"],
        "minecraft": server["minecraft"],
        "loader": server.get("loader"),
        "java": server["java"],
        # Carpetas que el launcher deja identicas al manifiesto (borra lo que sobre).
        "managed": ["mods"],
        "files": files,
    }
    payload = json.dumps(manifest, ensure_ascii=False, indent=1).encode()
    version = hashlib.sha1(payload).hexdigest()[:12]
    (OUT / server["id"]).mkdir(parents=True, exist_ok=True)
    (OUT / server["id"] / "manifest.json").write_bytes(payload)
    server["manifest"] = f"{BASE_URL}/{server['id']}/manifest.json"
    server["version"] = version
    server["size"] = sum(f["size"] for f in files)
    server["mods"] = len(files)
    return server


def main():
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = {"servers": [build_server(s) for s in discover(overrides)]}
    # Solo se reescribe si cambio algo, para que cron no toque el archivo cada 5 minutos.
    target = OUT / "catalog.json"
    old = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    old.pop("updated", None)
    if old == catalog:
        return
    tmp = OUT / "catalog.json.tmp"
    tmp.write_text(json.dumps({"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **catalog}, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(target)
    for s in catalog["servers"]:
        state = "encendido" if s["running"] else "apagado"
        print(f"{s['id']} ({state}): {s['mods']} archivos, {s['size'] / 1e6:.0f} MB, version {s['version']}")


if __name__ == "__main__":
    main()
