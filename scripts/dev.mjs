import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const backendDirectory = fileURLToPath(new URL('../backend/', import.meta.url));
let backend;
let server;
let stopping = false;

async function ready() {
  try {
    const response = await fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).service === 'Vitra API';
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
    console.log('Using the Vitra backend already running on port 8000.');
  } else {
    console.log('Starting the Vitra backend. Waiting for Python to become ready…');
    backend = spawn(process.env.VITRA_PYTHON || 'python', [
      '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000',
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
} catch (error) {
  console.error(error.message);
  await stop(1);
}
