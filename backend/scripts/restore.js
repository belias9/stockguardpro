require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
    const archivePath = process.argv[2] ? path.resolve(process.argv[2]) : '';
    if (!archivePath || !fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) throw new Error('Pass an existing backup archive path: npm run restore:db -- <archive-path>');
    if (process.env.CONFIRM_RESTORE !== 'YES') throw new Error('Set CONFIRM_RESTORE=YES after checking the target database and archive');
    const uri = process.env.RESTORE_MONGODB_URI || (process.env.APP_MODE === 'local' ? process.env.MONGODB_URI_LOCAL : process.env.MONGODB_URI);
    if (!uri) throw new Error('Set RESTORE_MONGODB_URI or configure the target database URI in backend/.env');
    const args = ['--uri', uri, `--archive=${archivePath}`, '--gzip'];
    if (process.env.RESTORE_DROP === 'YES') args.push('--drop');
    const result = spawnSync('mongorestore', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw new Error(`mongorestore could not run: ${result.error.message}. Install MongoDB Database Tools and ensure mongorestore is on PATH.`);
    if (result.status !== 0) {
        const safeError = String(result.stderr || 'mongorestore failed').replaceAll(uri, '[database URI redacted]').trim();
        throw new Error(safeError);
    }
    console.log('Restore completed. Verify the restored database and application workflows before directing users to it.');
}

try { main(); }
catch (err) { console.error(`Restore failed: ${err.message}`); process.exitCode = 1; }
