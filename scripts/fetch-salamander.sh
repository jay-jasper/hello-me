#!/bin/bash
# 拉取 Salamander Grand Piano 采样（CC-BY 3.0, Alexander Holm）。
# 上游按小三度网格提供 C / D#(Ds) / F#(Fs) / A 四音一组，A0–C8 共 27 个。
set -euo pipefail

DEST="$(dirname "$0")/../src/piano/assets/salamander"
BASE="https://tonejs.github.io/audio/salamander"
NOTES="A0 C1 Ds1 Fs1 A1 C2 Ds2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6 Ds6 A6 C7 A7 C8"

mkdir -p "$DEST"
for n in $NOTES; do
  if [ -f "$DEST/$n.mp3" ]; then
    echo "skip $n"
    continue
  fi
  echo "fetch $n"
  curl -sSf --max-time 30 "$BASE/$n.mp3" -o "$DEST/$n.mp3"
done

echo "--- total ---"
du -sh "$DEST"
ls "$DEST" | wc -l
