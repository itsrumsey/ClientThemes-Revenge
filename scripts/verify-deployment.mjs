import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [base, expectedHash] = process.argv.slice(2);
const url = new URL(base);
assert.equal(url.protocol, 'https:');
assert.ok(url.pathname.endsWith('/'), 'Legacy install URL must end with /');
assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/);
let last;
for (let attempt = 0; attempt < 12; attempt++) {
    try {
        // No GitHub token or authentication header: this checks public installation access.
        const [manifestResponse, bundleResponse] = await Promise.all([
            fetch(new URL('manifest.json', url), { cache: 'no-store', signal: AbortSignal.timeout(15000) }),
            fetch(new URL('index.js', url), { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        ]);
        assert.equal(manifestResponse.status, 200, 'Public manifest HTTP status');
        assert.equal(bundleResponse.status, 200, 'Public bundle HTTP status');
        assert.match(manifestResponse.headers.get('content-type'), /application\/json/i);
        const manifest = await manifestResponse.json();
        const bytes = Buffer.from(await bundleResponse.arrayBuffer());
        const hash = createHash('sha256').update(bytes).digest('hex');
        assert.equal(manifest.main, 'index.js');
        assert.equal(manifest.name, 'ClientThemes Revived');
        assert.equal(manifest.description, 'Modernized ClientThemes for Revenge. Persistent theme selection, automatic startup restoration, and self-healing theme recovery.');
        assert.ok(manifest.authors.some(a => a.name === 'sapphire' && a.id === '757982547861962752'));
        assert.ok(manifest.vendetta, 'Legacy polymanifest metadata');
        assert.equal(manifest.hash, hash, 'Deployed bundle must match public manifest');
        assert.equal(hash, expectedHash, 'CDN must serve this run, not an older deployment');
        assert.match(bytes.toString(), /GPL-3\.0/);
        assert.ok(bytes.length > 1000, 'Compiled bundle must not be an HTML error page');
        console.log(JSON.stringify({ installUrl: url.href, manifestStatus: 200, bundleStatus: 200,
            name: manifest.name, description: manifest.description, bytes: bytes.length, sha256: hash, format: 'legacy-vendetta', publicAccess: true }));
        process.exit(0);
    } catch (error) {
        last = error;
        console.log(`Public verification attempt ${attempt + 1}: ${error.message}`);
        if (attempt < 11) await delay(Math.min(1000 * 2 ** attempt, 10000));
    }
}
throw last;
