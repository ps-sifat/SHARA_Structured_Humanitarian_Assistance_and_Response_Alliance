"""Build an exact-match UI catalogue from SHARA's existing bilingual labels."""
import ast
import html
import json
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.translation import gettext, override


def bilingual_pair(value):
    bn, separator, en = value.strip().partition(' / ')
    if separator and re.search(r'[\u0980-\u09ff]', bn) and en and not re.search(r'[\u0980-\u09ff]', en):
        return bn.strip(), en.strip()


def collect_pairs(root):
    pairs = set()
    for path in sorted(root.rglob('*.py')):
        if any(part in {'migrations', '__pycache__', 'management'} for part in path.parts) or path.name.startswith('test'):
            continue
        tree = ast.parse(path.read_text(encoding='utf-8-sig'))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                pair = bilingual_pair(node.value)
                if pair:
                    pairs.add(pair)
    for path in sorted((root / 'templates').rglob('*.html')):
        # Template syntax and tags delimit literal UI text; never inspect stored user data.
        text = re.sub(r'{[{%].*?[%}]}', '\n', path.read_text(encoding='utf-8'), flags=re.S)
        for fragment in re.split(r'<[^>]*>|\n', text):
            pair = bilingual_pair(html.unescape(fragment))
            if pair:
                pairs.add(pair)
    return sorted(pairs)


class Command(BaseCommand):
    help = 'Rebuild the browser language catalogue after adding bilingual UI labels.'

    def handle(self, *args, **options):
        root = Path(settings.BASE_DIR)
        pairs = collect_pairs(root)
        # Translate framework-provided validation/help text with Django's own catalogue.
        framework = [
            'This field is required.', 'Enter a valid email address.', 'Enter a valid URL.',
            'Enter a whole number.', 'Enter a number.', 'Enter a valid value.',
            'Select a valid choice. That choice is not one of the available choices.',
            'Enter a list of values.', 'Password', 'Password confirmation',
            'The two password fields didn’t match.', 'This password is too common.',
            "The two password fields didn't match.",
            'This password is entirely numeric.',
            'Your password can’t be too similar to your other personal information.',
            'Your password can’t be a commonly used password.',
            'Your password can’t be entirely numeric.',
            "Your password can't be too similar to your other personal information.",
            "Your password can't be a commonly used password.",
            "Your password can't be entirely numeric.",
            'Your old password was entered incorrectly. Please enter it again.',
            'Enter the same password as before, for verification.',
            'Old password', 'New password', 'New password confirmation',
        ]
        with override('bn'):
            for en in framework:
                bn = gettext(en)
                if bn != en:
                    pairs.append((bn, en))
        target = root / 'static' / 'ui-translations.json'
        target.write_text(json.dumps(pairs, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Wrote {len(pairs)} UI translations to {target.name}.'))
