#!/bin/sh
# Фавикон и иконки устройств из знака логотипа выгрузки (src/assets/brand/logo-forrest-mark.svg = design-export/logo-forrest-mark.svg).
# Знак не перерисовывается и не перекрашивается: тот же файл, по центру белого квадрата с полями
# (как в выгрузке — знак на белом круге метки карты). Нужен ImageMagick (convert). Результат — в public/, коммитится.
# Запуск из корня проекта: sh scripts/make-icons.sh
set -e
MARK=src/assets/brand/logo-forrest-mark.svg
OUT=public
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Знак без метаданных (c2pa) — только для растеризации; сам файл знака не меняется.
sed 's#<metadata>.*</metadata>##' "$MARK" > "$TMP/mark.svg"

# icon SIZE MARK_WIDTH FILE — знак шириной MARK_WIDTH по центру белого квадрата SIZE.
icon() {
  convert -background none -density 1600 "$TMP/mark.svg" -resize "$2x" \
    -gravity center -background white -extent "$1x$1" -strip "$3"
}
icon 512 340 "$OUT/icon-512.png"           # манифест; поля ≥ 20% — годится и как maskable
icon 192 128 "$OUT/icon-192.png"
icon 180 124 "$OUT/apple-touch-icon.png"   # iOS: непрозрачный фон обязателен
icon 48 38 "$TMP/48.png"
icon 32 26 "$TMP/32.png"
icon 16 14 "$TMP/16.png"
convert "$TMP/16.png" "$TMP/32.png" "$TMP/48.png" "$OUT/favicon.ico"

# SVG-фавикон: белая подложка + знак как есть (пути и цвет из файла логотипа).
VB=$(grep -o 'viewBox="[^"]*"' "$TMP/mark.svg" | head -1 | sed 's/viewBox="\(.*\)"/\1/')
W=$(echo "$VB" | cut -d' ' -f3); H=$(echo "$VB" | cut -d' ' -f4)
INNER=$(sed -e 's#^.*<svg[^>]*>##' -e 's#</svg>.*$##' "$TMP/mark.svg" | tr -d '\n')
cat > "$OUT/favicon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#fff"/><svg x="8" y="8" width="48" height="48" viewBox="$VB">$INNER</svg></svg>
SVG
ls -l "$OUT"/favicon.* "$OUT"/*.png
