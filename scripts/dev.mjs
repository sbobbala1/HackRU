import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const backendDirectory = fileURLToPath(new URL('../backend/', import.meta.url));
const apiPort = process.env.VITRA_API_PORT || '8000';
if (process.argv.includes('--demo')) process.env.VITE_DEMO_MODE = 'true';
let backend;
let server;
let stopping = false;
let incompatibleBackend = false;

async function ready() {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/health`, { signal: AbortSignal.timeout(1000) });
    const health = await response.json();
    if (response.ok && health.service === 'Vitra API' && health.workflow_version !== 'qa-workflow-1') incompatibleBackend = true;
    return response.ok && health.service === 'Vitra API' && health.workflow_version === 'qa-workflow-1';
  } catch { return false; }
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await server?.close();
  backend?.kill();
  process.exit(code);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

try {
  if (await ready()) {
    console.log(`Using the Vitra backend already running on port ${apiPort}.`);
  } else {
    if (incompatibleBackend) throw new Error(`An older Vitra backend is running on port ${apiPort}. Stop its terminal with Ctrl+C, then run this command again.`);
    console.log('Starting the Vitra backend. Waiting for Python to become ready…');
    backend = spawn(process.env.VITRA_PYTHON || 'python', [
      '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', apiPort,
    ], { cwd: backendDirectory, stdio: 'inherit', windowsHide: true });
    backend.on('error', error => {
      console.error(`Could not start Python: ${error.message}`);
      stop(1);
    });
    backend.on('exit', code => {
      if (!stopping) {
        console.error('The Vitra backend stopped. Install dependencies with: python -m pip install -r backend/requirements.txt');
        stop(code || 1);
      }
    });
    let connected = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await ready()) { connected = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!connected) throw new Error('Backend did not become ready. Check the Python error above.');
  }
  server = await createServer({ root });
  await server.listen();
  console.log('Vitra website and API are ready. Keep this terminal open.');
  server.printUrls();
  if (process.argv.includes('--demo')) console.log('Open /demo at the Local address for the complete deterministic judging workflow.');
} catch (error) {
  console.error(error.message);
  await stop(1);
}
