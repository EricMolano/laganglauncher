#!/usr/bin/env python3
"""Genera el catalogo del launcher de La Gang.

Publica en /srv/minecraft/skins/launcher/v1 (servido por mc-skins en :8090):
  catalog.json             lista de servidores
  <id>/manifest.json       archivos que necesita el cliente de ese servidor
  files/<sha1[:2]>/<sha1>  contenido (enlaces duros a los jars originales)

Volver a correrlo tras cambiar mods: python3 /root/mc-setup/launcher_catalog.py
"""
import hashlib
import json
import os
import time
from pathlib import Path

OUT = Path("/srv/minecraft/skins/launcher/v1")
BASE_URL = "http://209.145.60.34:8090/launcher/v1"

SERVERS = [
    {
        "id": "gang",
        "name": "La Gang · Historia",
        "tagline": "Las Grietas · Acto 0",
        "description": "No recuerdas cómo llegaste aquí. La grieta de amatista te arrastró hasta Meridian.",
        "kicker": "Las Grietas · Acto 0",
        "headline": "Despertar",
        "quote": "No recuerdas cómo llegaste aquí.",
        "scene": "gang",
        "host": "209.145.60.34",
        "port": 25565,
        "minecraft": "1.21.1",
        "loader": {"type": "fabric", "version": "0.19.5"},
        "java": 21,
        "memory": {"min": 4096, "recommended": 8192},
        "sources": {"mods": ["/root/modpack/jars", "/root/modpack/cliente"]},
    },
    {
        "id": "lucky",
        "name": "Lucky Block Race",
        "tagline": "Carreras de lucky blocks",
        "description": "Rompe, reza y corre. Cada bloque puede salvarte o acabar contigo.",
        "kicker": "Minijuego · Forge 1.20.1",
        "headline": "Lucky Block Race",
        "quote": "Rompe, corre y que la suerte decida.",
        "scene": "lucky",
        "host": "209.145.60.34",
        "port": 25566,
        "minecraft": "1.20.1",
        "loader": {"type": "forge", "version": "47.4.28"},
        "java": 17,
        "memory": {"min": 2048, "recommended": 4096},
        "sources": {"mods": ["/srv/lucky/data/mods/lbu2-1.3-forge-1.20.1.jar"]},
    },
]


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
    for folder, sources in server.pop("sources").items():
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
        "loader": server["loader"],
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
    OUT.mkdir(parents=True, exist_ok=True)
    servers = [build_server(dict(s)) for s in SERVERS]
    catalog = {"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "servers": servers}
    tmp = OUT / "catalog.json.tmp"
    tmp.write_text(json.dumps(catalog, ensure_ascii=False, indent=1))
    tmp.replace(OUT / "catalog.json")
    for s in servers:
        print(f"{s['id']}: {s['mods']} archivos, {s['size'] / 1e6:.0f} MB, version {s['version']}")


if __name__ == "__main__":
    main()
