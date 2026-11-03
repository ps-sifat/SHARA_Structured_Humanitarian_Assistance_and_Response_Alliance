from pathlib import Path
from django.core.exceptions import ValidationError

from django.core.management.base import BaseCommand, CommandError

from shara_accounts.models import User
from resource_contacts.models import import_officers


class Command(BaseCommand):
    help = 'Import officer CSV data into ResourceContact as unpublished drafts.'

    def add_arguments(self, parser):
        parser.add_argument('path', nargs='?', default='data/officers.csv')
        parser.add_argument('--actor-phone', default='')
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        actor_qs = User.objects.filter(is_superuser=True, is_active=True)
        if options['actor_phone']:
            actor_qs = actor_qs.filter(phone=options['actor_phone'])
        actor = actor_qs.first()
        if not actor:
            raise CommandError('No active superuser found; pass --actor-phone.')
        path = Path(options['path'])
        if not path.exists():
            raise CommandError(f'CSV not found: {path}')
        try:
            result = import_officers(path, actor, dry_run=options['dry_run'])
        except (OSError, ValueError, ValidationError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(
            f"rows={result['rows']} created={result['created']} "
            f"updated={result['updated']} dry_run={result['dry_run']}"
        ))
