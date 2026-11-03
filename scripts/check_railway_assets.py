"""Fail the image build if Git LFS pointer files replace application data."""
from pathlib import Path
import sys


def find_lfs_pointers(root):
    marker = b'version https://git-lfs.github.com/spec/v1'
    pointers = []
    for path in root.rglob('*'):
        if path.is_file():
            with path.open('rb') as source:
                if source.read(len(marker)) == marker:
                    pointers.append(path)
    return pointers


if __name__ == '__main__':
    pointers = find_lfs_pointers(Path('Sara'))
    if pointers:
        print('Build stopped: these application files are Git LFS pointers, not their actual content:', file=sys.stderr)
        for path in pointers:
            print(f'  {path}', file=sys.stderr)
        print('Materialize the Git LFS files in your local working tree, then deploy that tree with railway up.', file=sys.stderr)
        sys.exit(1)
