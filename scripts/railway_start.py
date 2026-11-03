"""Initialize persistent Railway storage and start the existing Django app."""
import os
from contextlib import closing
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile

ROOT = Path('/app')
VOLUME = Path('/data')


def seed_database(source, destination):
    if destination.exists():
        return
    if not source.is_file():
        raise RuntimeError(f'Bundled database is missing: {source}')
    fd, name = tempfile.mkstemp(prefix='.shara-seed-', suffix='.sqlite3', dir=destination.parent)
    os.close(fd)
    temporary = Path(name)
    try:
        with closing(sqlite3.connect(f'{source.as_uri()}?mode=ro', uri=True)) as origin:
            with closing(sqlite3.connect(temporary)) as target:
                origin.backup(target)
        # A hard link creates the destination only if it does not already exist.
        try:
            os.link(temporary, destination)
        except FileExistsError:
            pass
    finally:
        temporary.unlink(missing_ok=True)


def seed_media(source, destination):
    if not source.is_dir():
        return
    for original in source.rglob('*'):
        if not original.is_file():
            continue
        target = destination / original.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            continue
        fd, name = tempfile.mkstemp(prefix='.media-seed-', dir=target.parent)
        temporary = Path(name)
        try:
            with os.fdopen(fd, 'wb') as output, original.open('rb') as input_file:
                shutil.copyfileobj(input_file, output)
            try:
                os.link(temporary, target)
            except FileExistsError:
                pass
        finally:
            temporary.unlink(missing_ok=True)


def main():
    if os.environ.get('RAILWAY_VOLUME_MOUNT_PATH') != str(VOLUME) or not VOLUME.is_mount():
        raise RuntimeError('Attach a Railway volume at /data before starting the service.')
    seed_database(ROOT / 'Sara/shara.sqlite3', VOLUME / 'shara.sqlite3')
    media_marker = VOLUME / '.shara-media-seeded'
    if not media_marker.exists():
        seed_media(ROOT / 'Sara/media', VOLUME / 'media')
        media_marker.touch(exist_ok=True)
    subprocess.run([sys.executable, 'manage.py', 'migrate', '--noinput'], cwd=ROOT / 'Sara', check=True)
    subprocess.run([sys.executable, 'manage.py', 'collectstatic', '--noinput'], cwd=ROOT / 'Sara', check=True)
    os.chdir(ROOT / 'Sara')
    port = os.environ.get('PORT', '8000')
    os.execvp('gunicorn', ['gunicorn', 'Sara.wsgi:application', '--bind', f'0.0.0.0:{port}'])


if __name__ == '__main__':
    main()
