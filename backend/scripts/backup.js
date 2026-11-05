require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
    const uri = process.env.APP_MODE === 'local' ? process.env.MONGODB_URI_LOCAL : process.env.MONGODB_URI;
    if (!uri) throw new Error(process.env.APP_MODE === 'local' ? 'Set MONGODB_URI_LOCAL in backend/.env' : 'Set MONGODB_URI in backend/.env');
    const outputDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '../backups'));
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(outputDir, `stockguardpro-${process.env.APP_MODE || 'cloud'}-${stamp}.archive.gz`);
    const result = spawnSync('mongodump', ['--uri', uri, `--archive=${filename}`, '--gzip'], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw new Error(`mongodump could not run: ${result.error.message}. Install MongoDB Database Tools and ensure mongodump is on PATH.`);
    if (result.status !== 0) {
        try { fs.unlinkSync(filename); } catch {}
        const safeError = String(result.stderr || 'mongodump failed').replaceAll(uri, '[database URI redacted]').trim();
        throw new Error(safeError);
    }
    const stat = fs.statSync(filename);
    if (!stat.size) { fs.unlinkSync(filename); throw new Error('Backup archive is empty'); }
    console.log(`Backup created: ${filename} (${stat.size} bytes)`);
    console.log('Copy it to encrypted, access-controlled storage and test restoring it.');
}

try { main(); }
catch (err) { console.error(`Backup failed: ${err.message}`); process.exitCode = 1; }
