#!/usr/bin/env bash
# Convert build/icon.png -> build/icon.icns using macOS-native tools.
# No-ops gracefully on non-macOS (electron-builder will fall back to the PNG).
set -e
cd "$(dirname "$0")/.."

SRC="build/icon.png"
ICONSET="build/icon.iconset"

if [ ! -f "$SRC" ]; then
  echo "build/icon.png missing — run: node scripts/gen-icon.js"
  exit 1
fi

if ! command -v sips >/dev/null 2>&1 || ! command -v iconutil >/dev/null 2>&1; then
  echo "sips/iconutil not found (not macOS) — keeping PNG icon only."
  exit 0
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# iconutil expects these exact names/sizes.
sips -z 16   16   "$SRC" --out "$ICONSET/icon_16x16.png"      >/dev/null
sips -z 32   32   "$SRC" --out "$ICONSET/icon_16x16@2x.png"   >/dev/null
sips -z 32   32   "$SRC" --out "$ICONSET/icon_32x32.png"      >/dev/null
sips -z 64   64   "$SRC" --out "$ICONSET/icon_32x32@2x.png"   >/dev/null
sips -z 128  128  "$SRC" --out "$ICONSET/icon_128x128.png"    >/dev/null
sips -z 256  256  "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256  256  "$SRC" --out "$ICONSET/icon_256x256.png"    >/dev/null
sips -z 512  512  "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512  512  "$SRC" --out "$ICONSET/icon_512x512.png"    >/dev/null
cp "$SRC" "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o build/icon.icns
rm -rf "$ICONSET"
echo "Created build/icon.icns"
