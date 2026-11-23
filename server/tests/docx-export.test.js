import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDocx } from '../../client/src/lib/docx.js';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function readStoredZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  assert.notEqual(eocd, -1, 'ZIP end-of-central-directory exists');
  const count = buffer.readUInt16LE(eocd + 10), centralOffset = buffer.readUInt32LE(eocd + 16);
  const files = new Map(); let cursor = centralOffset;
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50, 'central directory signature');
    const method = buffer.readUInt16LE(cursor + 10), expectedCrc = buffer.readUInt32LE(cursor + 16);
    const size = buffer.readUInt32LE(cursor + 24), nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30), commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.equal(method, 0, 'entries use ZIP store mode');
    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50, 'local file header signature');
    const localNameLength = buffer.readUInt16LE(localOffset + 26), localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), expectedCrc, 'entry CRC matches');
    files.set(name, data.toString('utf8'));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test('investigation report DOCX is a valid Open XML ZIP package', async () => {
  const blob = makeDocx('CALIBREX OSINT STUDIO — INVESTIGATION REPORT\nCASE DETAILS\nSubject: বাংলা & <script>\n');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const files = readStoredZip(Buffer.from(await blob.arrayBuffer()));
  assert.ok(files.has('[Content_Types].xml'));
  assert.ok(files.has('_rels/.rels'));
  assert.ok(files.has('word/document.xml'));
  const document = files.get('word/document.xml');
  assert.match(document, /বাংলা/);
  assert.match(document, /&amp; &lt;script&gt;/);
  assert.match(document, /wordprocessingml\/2006\/main/);
});
