import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'source-candidate-batches');
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,100}$/;

function readBatch(id) {
  if (!SAFE_ID.test(String(id || ''))) throw new Error('Invalid source batch identifier.');
  const file = path.resolve(ROOT, `${id}.json`);
  if (!file.startsWith(ROOT + path.sep)) throw new Error('Invalid source batch path.');
  const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!batch || !Array.isArray(batch.candidates) || batch.candidates.length === 0) throw new Error('Source batch has no candidates.');
  if (batch.candidates.length > 500) throw new Error('Source batch exceeds the 500-record import limit.');
  return batch;
}

export function listSourceCandidateBatches() {
  if (!fs.existsSync(ROOT)) return [];
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^[a-z0-9][a-z0-9-]{0,100}\.json$/.test(entry.name))
    .map(entry => {
      const id = entry.name.slice(0, -5);
      try {
        const batch = readBatch(id);
        return { id, batch: String(batch.batch || id), region: String(batch.region || 'Global / multilateral'), candidateCount: batch.candidates.length, createdAt: String(batch.createdAt || ''), policy: String(batch.policy || '') };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadSourceCandidateBatch(id) {
  return readBatch(id);
}
