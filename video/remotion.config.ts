import fs from 'node:fs';
import path from 'node:path';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');

// On Windows ARM64, point Remotion cleanly to the win32-x64 compositor (runs via Prism)
if (process.platform === 'win32' && process.arch === 'arm64') {
  const winX64Dir = path.resolve(
    process.cwd(),
    'node_modules',
    '@remotion',
    'compositor-win32-x64-msvc'
  );
  if (fs.existsSync(winX64Dir)) {
    Config.setBinariesDirectory(winX64Dir);
  }
}
