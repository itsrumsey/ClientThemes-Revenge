"""Use the template's root manifest/script layout for ZIP and Actions downloads."""
import json
import pathlib
import shutil
import zipfile


def validate_package(path):
    with zipfile.ZipFile(path) as archive:
        if 'manifest.json' not in archive.namelist():
            raise ValueError('Missing root manifest.json: nested plugin ZIPs are not installable')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('format') != 1 or 'revenge.api' not in manifest.get('dependencies', {}):
            raise ValueError('Not a format-1 Next plugin manifest')
        script = manifest['dist']['script']
        if script not in archive.namelist() or not archive.read(script):
            raise ValueError('Missing or empty script declared by dist.script')
        if archive.testzip() is not None:
            raise ValueError('Corrupt ZIP entry')
        return manifest


def package(root):
    plugin = root / 'plugins/client-themes'
    manifest = json.loads((plugin / 'manifest.json').read_text())
    bundle = plugin / 'build/js/index.js'
    if not bundle.is_file() or not bundle.stat().st_size:
        raise ValueError('Run npm run build and the bundle check first.')
    output = root / 'build/dist'
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"{manifest['id']}@{manifest['version']}.zip"
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.write(plugin / 'manifest.json', 'manifest.json')
        archive.write(bundle, manifest['dist']['script'])
        archive.write(root / 'LICENSE', 'LICENSE')
        archive.write(root / 'README.md', 'README.md')
        for source in sorted((plugin / 'src').glob('*.js')):
            archive.write(source, 'source/' + source.name)
    validate_package(target)
    # Actions creates its own ZIP. Upload these contents, not the ZIP above.
    install = root / 'build/install'
    if install.exists():
        shutil.rmtree(install)
    install.mkdir(parents=True)
    with zipfile.ZipFile(target) as archive:
        archive.extractall(install)  # Only our freshly generated validated archive.
    return target, install


if __name__ == '__main__':
    target, install = package(pathlib.Path(__file__).resolve().parents[1])
    print(f'Plugin ZIP: {target}\nActions upload contents: {install}')
