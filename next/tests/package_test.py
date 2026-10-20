import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('packaging', pathlib.Path(__file__).resolve().parents[1] / 'scripts/package.py')
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class PackageTests(unittest.TestCase):
    def test_downloaded_actions_zip_is_directly_installable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            plugin = root / 'plugins/client-themes'
            (plugin / 'build/js').mkdir(parents=True)
            (plugin / 'src').mkdir()
            (plugin / 'build/js/index.js').write_text('plugin({})')
            manifest = {'id': 'test.plugin', 'version': '0.1.0', 'format': 1,
                        'dependencies': {'revenge.api': {'version': '>=1 <2'}}, 'dist': {'script': 'index.js'}}
            (plugin / 'manifest.json').write_text(json.dumps(manifest))
            for name in ['LICENSE', 'README.md']:
                (root / name).write_text(name)
            target, install = packaging.package(root)
            self.assertEqual(packaging.validate_package(target), manifest)
            download = root / 'ClientThemes-Next-installable.zip'
            with zipfile.ZipFile(download, 'w') as archive:
                for path in install.rglob('*'):
                    if path.is_file():
                        archive.write(path, path.relative_to(install))
            self.assertEqual(packaging.validate_package(download), manifest)
            with zipfile.ZipFile(download) as archive:
                self.assertFalse(any(name.endswith('.zip') for name in archive.namelist()))

    def test_nested_plugin_zip_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'wrapper.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('plugin.zip', b'inner zip')
            with self.assertRaisesRegex(ValueError, 'Missing root manifest.json'):
                packaging.validate_package(path)

    def test_missing_script_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'missing-script.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('manifest.json', json.dumps({'format': 1, 'dependencies': {'revenge.api': {}}, 'dist': {'script': 'index.js'}}))
            with self.assertRaisesRegex(ValueError, 'Missing or empty script'):
                packaging.validate_package(path)
