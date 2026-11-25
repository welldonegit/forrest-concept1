#!/usr/bin/env bash
# Сборка для попиксельной приёмки блоков ukraine-bukovel (выгрузка на украинском, блоки — только en):
# фикстуры с блоками на всех языках во временной копии, сборка, возврат фикстур. Потом:
#   npm run acceptance -- --block why
set -euo pipefail
F=src/content-fixtures/landing.json
cp "$F" "$F.bak"
trap 'mv "$F.bak" "$F"' EXIT
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$F'));for(const b of d.blocks)if(['whyUkraine','photoBand','whyBukovel'].includes(b._type))b.languages=[];fs.writeFileSync('$F',JSON.stringify(d,null,2)+'\n')"
npm run -s build:test
