#!/usr/bin/env bash
# Cierra o abre LA GANG mientras se termina el mapa ("La grieta se está abriendo…").
#
#   grieta.sh cerrar   echa a quien entre (salvo ops y tag grieta_staff) y cambia el MOTD
#                      (todo en el servidor: el launcher no se entera y lo echan al conectar)
#   grieta.sh abrir    lo deja todo como antes
#   grieta.sh estado
#
# No reinicia el servidor: el datapack se activa al instante con /datapack. El MOTD de MiniMOTD
# no se puede recargar en caliente: cambia en el próximo reinicio del servidor.
# Pueden entrar los ops y quien esté en STAFF_EXTRA (después de editarlo, volver a correr "cerrar").
set -euo pipefail

DATA=/srv/minecraft/data
PACK=$DATA/world/datapacks/grieta_cerrada
MOTD_DIR=$DATA/config/MiniMOTD

rcon() { docker exec mc rcon-cli "$@"; }

# Ops del servidor + nombres extra separados por espacio.
STAFF_EXTRA=""
staff() {
  python3 -c 'import json,sys; print(" ".join([o["name"] for o in json.load(open(sys.argv[1]))] + sys.argv[2].split()))' \
    "$DATA/ops.json" "$STAFF_EXTRA"
}

escribir_pack() {
  local selector="@a[tag=!grieta_staff"
  for n in $(staff); do selector+=",name=!$n"; done
  selector+="]"
  mkdir -p "$PACK/data/grieta/function" "$PACK/data/minecraft/tags/function"
  printf '{"pack":{"pack_format":48,"description":"LA GANG cerrada: la grieta se está abriendo"}}\n' > "$PACK/pack.mcmeta"
  printf '{"values":["grieta:tick"]}\n' > "$PACK/data/minecraft/tags/function/tick.json"
  printf 'kick %s §5§l☠ §dLa grieta se está abriendo… §5§l☠ §7Aún no está lista. Vuelve pronto.\n' "$selector" \
    > "$PACK/data/grieta/function/tick.mcfunction"
  chown -R --reference="$DATA/world/datapacks" "$PACK"
}

motd_cerrado() {
  python3 - "$MOTD_DIR/main.conf" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
nuevo = '''motds=[
    {
        icon=random
        line1="        <dark_purple><obf>!!</obf></dark_purple> <bold><gradient:#c084fc:#4c1d95:#c084fc:0.0>☠ LA GANG ☠</gradient></bold> <dark_purple><obf>!!</obf></dark_purple>"
        line2="    <light_purple>La grieta se está abriendo… <gray>aún no está lista"
    }
]'''
text = re.sub(r"motds=\[.*?\n\]", nuevo, text, count=1, flags=re.S)
open(path, "w", encoding="utf-8").write(text)
PY
}

case "${1:-}" in
  cerrar)
    [ -f "$MOTD_DIR/main.conf.abierto" ] || cp -p "$MOTD_DIR/main.conf" "$MOTD_DIR/main.conf.abierto"
    escribir_pack
    rcon reload >/dev/null
    rcon 'datapack enable "file/grieta_cerrada"'
    motd_cerrado
    # MiniMOTD (Fabric) no tiene comando de recarga: el MOTD cambia en el próximo reinicio.
    echo "LA GANG cerrada. Pueden entrar: $(staff) y quien tenga el tag grieta_staff."
    ;;
  abrir)
    rcon 'datapack disable "file/grieta_cerrada"' || true
    rm -rf "$PACK"
    if [ -f "$MOTD_DIR/main.conf.abierto" ]; then
      mv "$MOTD_DIR/main.conf.abierto" "$MOTD_DIR/main.conf"
      :  # el MOTD vuelve al de siempre en el próximo reinicio
    fi
    echo "LA GANG abierta."
    ;;
  estado)
    if [ -d "$PACK" ]; then echo "cerrada"; else echo "abierta"; fi
    ;;
  *)
    echo "uso: $0 cerrar|abrir|estado" >&2
    exit 1
    ;;
esac
