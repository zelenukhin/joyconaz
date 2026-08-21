#!/usr/bin/env node
//
// Подготовка иконок настольной сборки «EMDR-терапия с Joy-Con»
// из исходных PNG (папка icons/) в папку build/.
//
// Чистый Node.js: ни зависимостей, ни bash — одинаково работает
// на Windows, macOS и Linux. Заменяет прежний make-icons.sh, который
// на Windows требовал Git Bash и потому обычно просто НЕ ЗАПУСКАЛСЯ:
// папка build/ оставалась пустой, и electron-builder молча собирал
// .exe со стандартной иконкой Electron — именно это выглядело как
// «иконок просто нет».
//
// Запуск вручную:  npm run icons
// Автозапуск:       predist-хуки в package.json выполняют этот скрипт
//                   перед КАЖДОЙ сборкой (dist, dist:mac, dist:win),
//                   поэтому собрать приложение без иконок нельзя.
//
// Результат в build/:
//   icon.ico         — многослойная иконка Windows 16/32/64/128/256;
//                      именно её electron-builder встраивает в .exe
//                      (build.win.icon в package.json);
//   icon.png         — 1024×1024, единый источник для macOS, если нет .icns;
//   icon_256x256.png — иконка ОКНА в режиме разработки (main.js);
//   icon.icns        — иконка приложения macOS (через штатный iconutil;
//                      создаётся только при запуске на macOS).
//
// КАК СОБИРАЕТСЯ .ico: формат ICO позволяет хранить внутри контейнера
// готовые PNG без перекодирования (поддерживается Windows Vista+);
// ровно так же поступает и сам electron-builder при конвертации
// icon.png → icon.ico. Здесь в контейнер упаковываются УЖЕ ГОТОВЫЕ
// слои нужных размеров из исходных файлов — без масштабирования
// и без внешних инструментов (ImageMagick, png2ico и т. п.).

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'icons');
const BUILD_DIR = path.join(ROOT, 'build');

// Исходники (конвенция Apple iconset; @2x — Retina-варианты двойного
// размера: icon_16x16@2x.png — это 32×32, icon_512x512@2x.png — 1024×1024).
// Ключ — фактический размер картинки в пикселях.
const SOURCES = {
  16: 'icon_16x16.png',
  32: 'icon_32x32.png',
  64: 'icon_32x32@2x.png',
  128: 'icon_128x128.png',
  256: 'icon_256x256.png',
  512: 'icon_256x256@2x.png',
  1024: 'icon_512x512@2x.png',
};

// Слои, попадающие в build/icon.ico. Классический ICO-контейнер не
// поддерживает записи крупнее 256×256, поэтому 512 и 1024 в него не идут.
const ICO_SIZES = [16, 32, 64, 128, 256];

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const log = (message) => console.log(`[icons] ${message}`);
const warn = (message) => console.warn(`[icons] ВНИМАНИЕ: ${message}`);

// Проверка, что файл — настоящий PNG, а не JPEG/WebP с расширением .png.
// Частая причина «сборка прошла, а иконки нет» — именно фальшивый PNG:
// конвертеры молча принимают файл, но иконка получается битой.
const isPng = (buffer) =>
  buffer.length > 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);

// Размер картинки берётся из заголовка IHDR: ширина — смещение 16,
// высота — 20, обе в big-endian (uint32).
const pngSize = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

// Собирает .ico из готовых PNG. Формат: 6-байтовый заголовок, затем
// 16-байтовая запись-каталог на каждый слой, затем сами PNG-данные.
const buildIco = (entries) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];
  const images = [];
  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    // Значение 0 в поле размера означает 256.
    dir[0] = entry.width >= 256 ? 0 : entry.width;
    dir[1] = entry.height >= 256 ? 0 : entry.height;
    dir[2] = 0; // colorCount
    dir[3] = 0; // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bitCount
    dir.writeUInt32LE(entry.buffer.length, 8); // bytesInRes
    dir.writeUInt32LE(offset, 12); // imageOffset
    directory.push(dir);
    images.push(entry.buffer);
    offset += entry.buffer.length;
  }
  return Buffer.concat([header, ...directory, ...images]);
};

// ── Чтение и проверка исходников ────────────────────────────────────
if (!fs.existsSync(SRC_DIR)) {
  warn(`нет папки icons/ (${SRC_DIR}) — иконки НЕ собраны.`);
  warn(
    'Положите 10 PNG-файлов (icon_16x16.png … icon_512x512@2x.png, ' +
      'см. ICONS.md) и пересоберите приложение.'
  );
  process.exit(0);
}

const images = new Map(); // размер → { buffer, width, height, file }
for (const [size, file] of Object.entries(SOURCES)) {
  const full = path.join(SRC_DIR, file);
  if (!fs.existsSync(full)) {
    warn(`нет файла ${file} — слой ${size}×${size} пропущен.`);
    continue;
  }
  const buffer = fs.readFileSync(full);
  if (!isPng(buffer)) {
    warn(
      `${file} — не настоящий PNG (сигнатура не совпала). Частый случай: ` +
        'JPEG или WebP, переименованный в .png — пересохраните как PNG.'
    );
    continue;
  }
  const { width, height } = pngSize(buffer);
  if (width !== Number(size) || height !== Number(size)) {
    warn(
      `у ${file} фактический размер ${width}×${height}, ожидался ` +
        `${size}×${size} — файл используется как есть.`
    );
  }
  images.set(Number(size), { buffer, width, height, file });
}

if (images.size === 0) {
  warn('в icons/ не найден ни один пригодный PNG — иконки НЕ собраны.');
  process.exit(0);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });

// ── 1. build/icon.ico — иконка Windows, встраивается в .exe ─────────
const icoEntries = ICO_SIZES.map((size) => images.get(size))
  .filter(Boolean)
  .map(({ buffer, width, height }) => ({ buffer, width, height }));

if (icoEntries.length > 0) {
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), buildIco(icoEntries));
  log(
    `build/icon.ico — слои: ${icoEntries
      .map((entry) => `${entry.width}×${entry.height}`)
      .join(', ')}`
  );
} else {
  warn(
    'для build/icon.ico не нашлось ни одного слоя (нужны файлы от ' +
      'icon_16x16.png до icon_256x256.png).'
  );
}

// ── 2. build/icon.png — источник 1024×1024 (фолбэк для macOS) ───────
const master = images.get(1024) ?? images.get(512);
if (master) {
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), master.buffer);
  log(`build/icon.png — ${master.width}×${master.height}`);
} else {
  warn(
    'нет icon_512x512@2x.png (1024×1024) и icon_256x256@2x.png (512×512) — ' +
      'build/icon.png не записан.'
  );
}

// ── 3. build/icon_256x256.png — иконка окна в разработке ────────────
const windowIcon = images.get(256) ?? master;
if (windowIcon) {
  fs.writeFileSync(
    path.join(BUILD_DIR, 'icon_256x256.png'),
    windowIcon.buffer
  );
  log(`build/icon_256x256.png — ${windowIcon.width}×${windowIcon.height}`);
}

// ── 4. build/icon.icns — иконка приложения macOS ────────────────────
// Собирается штатной утилитой macOS iconutil; на Windows/Linux шаг
// пропускается — для сборки под Windows .icns не нужен.
if (process.platform === 'darwin') {
  try {
    const iconset = path.join(BUILD_DIR, 'icon.iconset');
    fs.rmSync(iconset, { recursive: true, force: true });
    fs.mkdirSync(iconset, { recursive: true });
    for (const file of fs.readdirSync(SRC_DIR)) {
      if (file.toLowerCase().endsWith('.png')) {
        fs.copyFileSync(path.join(SRC_DIR, file), path.join(iconset, file));
      }
    }
    execFileSync(
      'iconutil',
      ['-c', 'icns', iconset, '-o', path.join(BUILD_DIR, 'icon.icns')],
      { stdio: 'ignore' }
    );
    fs.rmSync(iconset, { recursive: true, force: true });
    log('build/icon.icns');
  } catch (error) {
    warn(`icon.icns не собран: ${error.message}`);
  }
} else {
  log('платформа не macOS — icon.icns пропущен (для Windows не нужен).');
}

log('готово. Сборка: npm run dist:win / npm run dist:mac');