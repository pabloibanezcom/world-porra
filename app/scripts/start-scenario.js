#!/usr/bin/env node

const { spawn } = require('child_process');

const scenario = process.argv[2];

if (!scenario || scenario === '--help' || scenario === '-h') {
  console.log('Usage: npm run app:vercel:scenario -- <scenario>');
  process.exit(0);
}

const child = spawn('npx', ['expo', 'start', '--lan', '--clear'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_PUBLIC_API_PRESET: 'vercel',
    EXPO_PUBLIC_API_SCENARIO: scenario,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
