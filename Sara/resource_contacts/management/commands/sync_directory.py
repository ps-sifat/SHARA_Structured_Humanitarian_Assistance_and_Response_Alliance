"""Scheduled, idempotent government/NGO directory refresh."""
import hashlib
import json
import os
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from resource_contacts.models import sync_crawled_contacts
from shara_accounts.models import User


@contextmanager
def directory_sync_lock(directory):
    """OS-owned lock: released automatically after a crash, without stale PID files."""
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'sync.lock').open('a+b') as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise CommandError('Another directory sync is already running.') from error
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def write_json(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


class Command(BaseCommand):
    help = 'Refresh public government and NGOAB contacts when each source is due (default: every 15 days).'

    def add_arguments(self, parser):
        parser.add_argument('--actor-phone', default='')
        parser.add_argument('--interval-days', type=int, default=15)
        parser.add_argument('--officer-seeds', type=Path, action='append')
        parser.add_argument('--ngo-seeds', type=Path, action='append')
        parser.add_argument('--sources', choices=['all', 'officers', 'ngos'], default='all')
        parser.add_argument('--state-dir', type=Path, default=settings.BASE_DIR.parent / '.runtime/directory-sync')
        parser.add_argument('--force', action='store_true', help='Ignore successful-source due dates.')
        parser.add_argument('--dry-run', action='store_true', help='Crawl and validate without changing contacts or due dates.')
        parser.add_argument('--drafts', action='store_true', help='Keep imported records unpublished.')
        parser.add_argument('--limit', type=int, help='Limit the number of source pages processed in this invocation.')
        parser.add_argument('--delay', type=float, default=1.5)
        parser.add_argument('--timeout', type=float, default=30)
        parser.add_argument('--user-agent', default='SHARADirectorySync/1.0')

    def handle(self, *args, **options):
        if options['interval_days'] < 1 or options['limit'] is not None and options['limit'] < 1:
            raise CommandError('Interval and limit must be positive.')
        if options['delay'] < 0 or options['timeout'] <= 0:
            raise CommandError('Delay must be nonnegative and timeout must be positive.')
        directory = options['state_dir'].resolve()
        with directory_sync_lock(directory):
            self.sync(directory, options)

    def sync(self, directory, options):
        try:
            from officer_crawler import OfficerCrawler, NGOCrawler, load_seeds
        except ImportError as error:
            raise CommandError('Install crawler dependencies: python -m pip install -e ./government_officer_crawler') from error

        state_path = directory / 'state.json'
        try:
            state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'sources': {}}
            if not isinstance(state.get('sources'), dict):
                raise ValueError('state.sources must be an object')
        except (ValueError, OSError) as error:
            raise CommandError(f'Cannot read sync state; preserve it and fix the error: {error}') from error

        seed_root = settings.BASE_DIR.parent / 'government_officer_crawler/seeds'
        seeds = []
        try:
            if options['sources'] in {'all', 'officers'}:
                files = options['officer_seeds'] or [seed_root / name for name in ['central_pages.csv', 'divisions_districts.csv', 'upazilas.csv']]
                for path in files:
                    for seed in load_seeds(path):
                        seed['record_type'] = 'officer'
                        seed.setdefault('level', 'upazila' if seed.get('upazila') else 'district' if seed.get('district') else 'central')
                        seeds.append(seed)
            if options['sources'] in {'all', 'ngos'}:
                for path in options['ngo_seeds'] or [seed_root / 'ngos.csv']:
                    seeds.extend({**seed, 'record_type': 'ngo'} for seed in load_seeds(path))
        except (OSError, ValueError) as error:
            raise CommandError(f'Cannot load crawler seed files: {error}') from error
        if not seeds:
            raise CommandError('No source pages are configured.')

        now = datetime.now(timezone.utc)
        due = []
        unique = set()
        for seed in seeds:
            key = seed['record_type'] + ':' + seed['url']
            if key in unique:
                continue
            unique.add(key)
            last = state['sources'].get(key, {}).get('last_success')
            try:
                last = datetime.fromisoformat(last) if last else None
                if last is not None and last.tzinfo is None:
                    raise ValueError('timestamp must include timezone')
            except (ValueError, TypeError) as error:
                raise CommandError(f'Invalid last-success timestamp for {key}.') from error
            if options['force'] or last is None or now >= last + timedelta(days=options['interval_days']):
                due.append((key, seed))
        if not due:
            self.stdout.write('No sources due; all configured sources were refreshed within the interval.')
            return
        if options['limit']:
            due = due[:options['limit']]

        actors = User.objects.filter(is_active=True, is_superuser=True, role='super_admin').order_by('pk')
        if options['actor_phone']:
            actors = actors.filter(phone=options['actor_phone'])
        actor = actors.first()
        if actor is None:
            raise CommandError('An active super-admin is required. Create one or pass --actor-phone.')

        run_directory = directory / 'runs' / now.strftime('%Y%m%dT%H%M%S%fZ')
        run_directory.mkdir(parents=True)
        report = {'started_at': now.isoformat(), 'dry_run': options['dry_run'], 'publish': not options['drafts'], 'sources': []}
        failures = 0
        with OfficerCrawler(delay=options['delay'], timeout=options['timeout'], user_agent=options['user_agent']) as officer_crawler, \
                NGOCrawler(delay=options['delay'], timeout=options['timeout'], user_agent=options['user_agent']) as ngo_crawler:
            for key, seed in due:
                crawler = ngo_crawler if seed['record_type'] == 'ngo' else officer_crawler
                self.stdout.write(f"Crawling {seed['record_type']}: {seed['url']}")
                self.stdout.flush()
                records = crawler.crawl([seed])
                source_report = dict(crawler.report[0])
                source_report['record_type'] = seed['record_type']
                if source_report['status'] == 'ok':
                    result = sync_crawled_contacts(
                        records if seed['record_type'] == 'officer' else [],
                        records if seed['record_type'] == 'ngo' else [],
                        actor, publish=not options['drafts'], dry_run=options['dry_run'],
                    )
                    source_report['import'] = result
                    if result['rejected']:
                        source_report['status'] = 'ok_with_rejections'
                    filename = hashlib.sha256(key.encode()).hexdigest()[:16] + '.json'
                    write_json(run_directory / filename, [asdict(record) for record in records])
                report['sources'].append(source_report)
                source_state = dict(state['sources'].get(key, {}))
                source_state.update(last_attempt=now.isoformat(), status=source_report['status'], error=source_report.get('error', ''))
                if source_report['status'] in {'ok', 'ok_with_rejections'}:
                    source_state['last_success'] = datetime.now(timezone.utc).isoformat()
                else:
                    failures += 1
                if not options['dry_run']:
                    state['sources'][key] = source_state
                    write_json(state_path, state)
                write_json(run_directory / 'report.json', report)

        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        write_json(run_directory / 'report.json', report)
        self.stdout.write(f'Report: {run_directory / "report.json"}')
        if failures:
            raise CommandError(f'{failures} source(s) failed or returned no supported records. Existing contacts were retained; see the report.')
        self.stdout.write(self.style.SUCCESS(f'Refreshed {len(due)} source(s). Next refresh is due in {options["interval_days"]} days.'))
