from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from geo_locations.models import import_locations


class Command(BaseCommand):
    help = 'Import bundled divisions, districts, upazilas and unions into Location; safe to repeat.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run',action='store_true',help='Validate matching and show counts without saving.')
        parser.add_argument('--database',default='default')

    def handle(self, *args, **options):
        try:
            with transaction.atomic(using=options['database']):
                result = import_locations(database=options['database'],dry_run=options['dry_run'])
        except ValidationError as error:
            raise CommandError('; '.join(error.messages))
        self.stdout.write(str(result))
        self.stdout.write(self.style.SUCCESS('Dry run complete; database unchanged.' if options['dry_run'] else 'Location references imported. Existing addresses and coverage links preserved.'))
