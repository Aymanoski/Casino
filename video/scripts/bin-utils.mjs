import fs from 'node:fs';
import path from 'node:path';

export function findFfmpeg(videoRoot) {
  const candidates = [
    path.join(
      videoRoot,
      'node_modules',
      '@remotion',
      'compositor-win32-x64-msvc',
      'ffmpeg.exe'
    ),
    path.join(
      videoRoot,
      'node_modules',
      '@ffmpeg-installer',
      'win32-x64',
      'ffmpeg.exe'
    ),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

export function findFfprobe(videoRoot) {
  const candidate = path.join(
    videoRoot,
    'node_modules',
    '@remotion',
    'compositor-win32-x64-msvc',
    'ffprobe.exe'
  );
  return fs.existsSync(candidate) ? candidate : null;
}

export function findChromiumExe() {
  const pwRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pwRoot)) {
    const dirs = fs
      .readdirSync(pwRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      const c1 = path.join(pwRoot, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(c1)) return c1;
      const c2 = path.join(pwRoot, d, 'chrome-win', 'chrome.exe');
      if (fs.existsSync(c2)) return c2;
    }
  }
  return undefined;
}
