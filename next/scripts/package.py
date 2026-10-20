"""Package the official Next JS output, without requiring the native Android toolchain."""
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
plugin = root / 'plugins/client-themes'
manifest = json.loads((plugin / 'manifest.json').read_text())
bundle = plugin / 'build/js/index.js'
if not bundle.is_file() or not bundle.stat().st_size:
    raise SystemExit('Run npm run build and the bundle check first.')
output = root / 'build/dist'
output.mkdir(parents=True, exist_ok=True)
target = output / f"{manifest['id']}@{manifest['version']}.zip"
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(plugin / 'manifest.json', 'manifest.json')
    archive.write(bundle, manifest['dist']['script'])
    archive.write(root / 'LICENSE', 'LICENSE')
    archive.write(root / 'README.md', 'README.md')
    # Corresponding plugin source accompanies every preview artifact.
    for source in sorted((plugin / 'src').glob('*.js')):
        archive.write(source, 'source/' + source.name)
print(target)
