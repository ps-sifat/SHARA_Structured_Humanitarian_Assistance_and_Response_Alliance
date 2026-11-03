from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from Sara.domain import TimestampedModel, normalize_phone


class ResourceContact(TimestampedModel):
    CATEGORIES = [('resource_supplier','সেবা সরবরাহকারী / Resource supplier'), ('government_official','সরকারি কর্মকর্তা / Government official'), ('institution','প্রতিষ্ঠান / Institution'), ('individual','ব্যক্তি / Individual'), ('other','অন্যান্য / Other')]
    CATEGORIES += [('ngo', 'এনজিও / NGO')]
    AVAILABILITY = [('available','প্রাপ্য / Available'), ('limited','সীমিত / Limited'), ('unavailable','অনুপলব্ধ / Unavailable'), ('unknown','অজানা / Unknown')]
    title = models.CharField(max_length=180)
    external_id = models.CharField(max_length=160, blank=True, default='', editable=False)
    contact_category = models.CharField(max_length=24, choices=CATEGORIES)
    services_description = models.TextField(blank=True)
    phone = models.CharField(blank=True)
    email = models.EmailField(blank=True)
    person_name = models.CharField(max_length=160, blank=True)
    institution_name = models.CharField(max_length=180, blank=True)
    designation = models.CharField(max_length=160, blank=True)
    location = models.ForeignKey('geo_locations.Location', on_delete=models.PROTECT, null=True, blank=True, related_name='resource_contacts')
    operating_hours = models.CharField(max_length=180, blank=True)
    availability = models.CharField(max_length=12, choices=AVAILABILITY, default='unknown')
    notes = models.TextField(blank=True)
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_resource_contacts')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='updated_resource_contacts')

    class Meta:
        ordering = ['title']
        constraints = [
            models.CheckConstraint(condition=models.Q(contact_category__in=['resource_supplier','government_official','institution','individual','other','ngo']), name='contact_category_valid'),
            models.UniqueConstraint(fields=['external_id'], condition=~models.Q(external_id=''), name='resource_external_id_unique'),
            models.CheckConstraint(condition=models.Q(availability__in=['available','limited','unavailable','unknown']), name='contact_availability_valid'),
            models.CheckConstraint(condition=models.Q(is_published=False) | ~models.Q(phone='',email=''), name='published_contact_reachable'),
        ]

    def clean(self):
        self.phone = normalize_phone(self.phone)
        if self.is_published and not (self.phone or self.email):
            raise ValidationError('প্রকাশের আগে ফোন বা ইমেইল দিন। / A phone or email is required to publish.')
        if self.location_id and self.location.kind != 'address':
            raise ValidationError({'location':'An address-kind location is required.'})

    def __str__(self):
        return self.title

# Services
import unicodedata

from django.db import transaction
from django.db.models import Q
from django.db.models import CharField
from django.db.models.functions import Cast, TruncMinute
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dates import MONTHS, MONTHS_3
from django.utils.translation import override

from Sara.domain import Role, normalize_digits, normalize_phone


def search_contacts(items, query):
    """Match all search words across public contact fields, preserving caller filters."""
    query = ' '.join(normalize_digits(unicodedata.normalize('NFC', query or '')).split())
    if not query:
        return items
    items = items.annotate(
        search_updated_at=Cast('updated_at', output_field=CharField()),
        search_updated_local=Cast(TruncMinute('updated_at', tzinfo=timezone.get_current_timezone()), output_field=CharField()),
    )
    fields = (
        'title', 'person_name', 'institution_name', 'services_description',
        'designation', 'phone', 'email', 'notes', 'operating_hours',
        'contact_category', 'availability', 'search_updated_at', 'search_updated_local', 'location__district',
        'location__division', 'location__upazila', 'location__union', 'location__village',
    )
    matches = Q()
    for word in query.split():
        word = word.strip('.,;·।')
        if not word:
            continue
        word_matches = Q()
        for field in fields:
            word_matches |= Q(**{f'{field}__icontains': word})
        for field, choices in [('contact_category', ResourceContact.CATEGORIES),
                               ('availability', ResourceContact.AVAILABILITY)]:
            codes = [code for code, label in choices if word.casefold() in str(label).casefold()]
            if codes:
                word_matches |= Q(**{f'{field}__in': codes})
        # Display dates use month names in either language, while SQLite stores ISO dates.
        months = set()
        for language in ['bn', 'en']:
            with override(language):
                for month in range(1, 13):
                    labels = [str(MONTHS[month]).casefold(), str(MONTHS_3[month]).casefold()]
                    if len(word) >= 3 and any(label.startswith(word.casefold()) for label in labels):
                        months.add(month)
        if months:
            word_matches |= Q(updated_at__month__in=months)
        matches &= word_matches
    try:
        phone = normalize_phone(query)
    except ValidationError:
        phone = None
    if phone:
        matches |= Q(phone__icontains=phone)
    return items.filter(matches)


@transaction.atomic
def save_contact(actor, data, contact_id=None):
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    contact = ResourceContact.objects.select_for_update().get(pk=contact_id) if contact_id else ResourceContact(created_by=actor)
    fields = {'title','contact_category','services_description','phone','email','person_name','institution_name','designation','location','operating_hours','availability','notes','is_published'}
    for field in fields & data.keys():
        setattr(contact, field, data[field])
    contact.updated_by = actor
    contact.save()
    return contact


@transaction.atomic
def contact_action(actor, contact_id, action):
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    contact = ResourceContact.objects.select_for_update().get(pk=contact_id)
    if action == 'remove':
        contact.delete()
        return None
    if action not in ['publish','hide']:
        from django.core.exceptions import ValidationError
        raise ValidationError('Unknown contact action.')
    contact.is_published = action == 'publish'
    contact.updated_by = actor
    contact.save()
    return contact


@transaction.atomic
def publish_all_contacts(actor):
    """Publish valid drafts; leave incomplete contacts available for correction."""
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    ready = []
    skipped = 0
    now = timezone.now()
    for contact in ResourceContact.objects.select_for_update().select_related('location').filter(is_published=False):
        contact.is_published = True
        contact.updated_by = actor
        contact.updated_at = now
        try:
            contact.full_clean(exclude=['created_by', 'updated_by', 'location'],
                               validate_unique=False, validate_constraints=False)
        except ValidationError:
            skipped += 1
            continue
        ready.append(contact)
    ResourceContact.objects.bulk_update(ready, ['is_published', 'phone', 'updated_by', 'updated_at'], batch_size=250)
    return len(ready), skipped


# Importer
"""Import officer CSV exports into ResourceContact as reviewable drafts."""
import csv
import re
from pathlib import Path

from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction

from Sara.domain import normalize_phone


REQUIRED_COLUMNS = {
    'officer_id', 'level', 'division', 'district', 'upazila', 'office',
    'name_bn', 'name_en', 'designation_code', 'designation_raw', 'phone',
    'email', 'source_url', 'retrieved_at',
}
SCIENTIFIC_PHONE = re.compile(r'^[-+]?\d+(?:\.\d+)?e[+-]?\d+$', re.I)


def _text(value):
    return str(value or '').strip()


def _email(value):
    for candidate in re.split(r'[,;|\s]+', _text(value)):
        if not candidate:
            continue
        try:
            validate_email(candidate)
        except ValidationError:
            continue
        return candidate.lower()
    return ''


def _phone(value):
    raw = _text(value)
    if not raw or SCIENTIFIC_PHONE.match(raw):
        return ''
    for candidate in re.split(r'[|,;/]+', raw):
        try:
            return normalize_phone(candidate)
        except ValidationError:
            continue
    return ''


def _location(row):
    from geo_locations.models import catalogue
    from geo_locations.models import Location
    district = _text(row.get('district'))
    upazila = _text(row.get('upazila'))
    if not district or district.lower() == 'central' or not upazila:
        return None
    district_code = next((code for code, area in catalogue().items()
                          if area['name'].split(' / ')[-1].casefold() == district.casefold()
                          or area['name'].split(' / ')[0].casefold() == district.casefold()), '')
    if not district_code:
        return None
    area = catalogue()[district_code]
    upazila_code = next((code for code, name in area['upazilas'].items()
                         if name.split(' / ')[-1].casefold() == upazila.casefold()
                         or name.split(' / ')[0].casefold() == upazila.casefold()), '')
    if not upazila_code:
        return None
    return Location.objects.filter(kind=Location.Kind.ADDRESS,
                                   district_code=district_code,
                                   upazila_code=upazila_code).first()


def _contact_from_row(row, actor, *, resolve_location=True):
    officer_id = _text(row.get('officer_id'))
    person = _text(row.get('name_bn')) or _text(row.get('name_en'))
    designation = _text(row.get('designation_raw'))
    office = _text(row.get('office'))
    title = ' — '.join(filter(None, [person, designation or office])) or f'Officer {officer_id}'
    raw_phone = _text(row.get('phone'))
    raw_email = _text(row.get('email'))
    notes = [
        f'CSV officer_id: {officer_id}',
        f"Level: {_text(row.get('level'))}",
        f"Designation code: {_text(row.get('designation_code'))}",
        f"Source: {_text(row.get('source_url'))}",
        f"Retrieved: {_text(row.get('retrieved_at'))}",
    ]
    if office:
        notes.append(f'Office: {office}')
    if _text(row.get('division')):
        notes.append(f"Division: {_text(row.get('division'))}")
    if _text(row.get('district')):
        notes.append(f"District: {_text(row.get('district'))}")
    if _text(row.get('upazila')):
        notes.append(f"Upazila: {_text(row.get('upazila'))}")
    if raw_phone and (SCIENCE := bool(SCIENTIFIC_PHONE.match(raw_phone))):
        notes.append(f'Unverified phone as supplied (scientific notation): {raw_phone}')
    if raw_phone and '|' in raw_phone:
        notes.append(f'Additional phone(s) as supplied: {raw_phone}')
    if raw_email and not _email(raw_email):
        notes.append(f'Unparsed email as supplied: {raw_email}')
    return ResourceContact(
        title=title[:180], contact_category='government_official',
        phone=_phone(raw_phone), email=_email(raw_email), person_name=person[:160],
        institution_name=office[:180], designation=designation[:160],
        location=_location(row) if resolve_location else None, availability='unknown', is_published=False,
        notes='\n'.join(notes), created_by=actor, updated_by=actor,
    )


@transaction.atomic
def import_officers(path, actor, dry_run=False):
    path = Path(path)
    with path.open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(f'Missing CSV columns: {", ".join(sorted(missing))}')
        rows = list(reader)
    created = updated = 0
    seen = set()
    for row in rows:
        officer_id = _text(row.get('officer_id'))
        if not officer_id or officer_id in seen:
            raise ValueError(f'Duplicate or empty officer_id: {officer_id!r}')
        seen.add(officer_id)
        existing = legacy_officer_contact(officer_id)
        contact = _contact_from_row(row, actor)
        if existing:
            contact.pk = existing.pk
            if dry_run:
                updated += 1
                continue
            ResourceContact.objects.filter(pk=existing.pk).update(
                title=contact.title, contact_category=contact.contact_category,
                phone=contact.phone, email=contact.email, person_name=contact.person_name,
                institution_name=contact.institution_name, designation=contact.designation,
                location=contact.location, availability=contact.availability,
                is_published=False, notes=contact.notes, updated_by=actor,
            )
            updated += 1
        else:
            if not dry_run:
                contact.save()
            created += 1
    return {'rows': len(rows), 'created': created, 'updated': updated, 'dry_run': dry_run}


def legacy_officer_contact(officer_id, *, candidate=None, source_url='', strict_office=False):
    """Match a complete legacy marker, never an ID substring (e.g. 12 vs 123)."""
    marker = f'CSV officer_id: {officer_id}'
    matches = [contact for contact in ResourceContact.objects.filter(
        contact_category='government_official', notes__contains=marker,
    ) if marker in contact.notes.splitlines()]
    if not matches and candidate is not None and source_url:
        source = f'Source: {source_url}'
        matches = [contact for contact in ResourceContact.objects.filter(
            contact_category='government_official', external_id='',
            person_name=candidate.person_name, designation=candidate.designation,
            notes__contains=source,
        ) if source in contact.notes.splitlines() and 'CSV officer_id:' in contact.notes]
        if strict_office and matches:
            exact_office = [contact for contact in matches if contact.institution_name == candidate.institution_name]
            if not exact_office:
                raise ValidationError('Multiple source entries share this legacy person/role; office identity needs review.')
            matches = exact_office
    if len(matches) > 1:
        raise ValidationError(f'Multiple existing contacts have officer ID {officer_id}.')
    return matches[0] if matches else None


def officer_source_notes(existing_notes, source_notes, external_id):
    """Keep the original CSV marker so both import workflows remain idempotent."""
    markers = [line for line in existing_notes.splitlines() if line.startswith('CSV officer_id: ')]
    if not markers:
        markers = [line for line in source_notes.splitlines() if line.startswith('CSV officer_id: ')]
    metadata = [line for line in source_notes.splitlines() if not line.startswith(('CSV officer_id: ', 'Crawler ID: '))]
    return '\n'.join([*markers, f'Crawler ID: {external_id}', *metadata])


def filter_contact_district(items, district_code):
    """Include public source districts without inventing a private address."""
    from geo_locations.models import catalogue

    area = catalogue().get(district_code)
    if not area:
        return items.none()
    source_district = Q()
    aliases = {
        'cumilla': ['Comilla'], 'chattogram': ['Chittagong'], 'bogura': ['Bogra'],
        'jashore': ['Jessore'], 'barishal': ['Barishal'],
        'jhalakathi': ['Jhalokati', 'Jhalokathi'],
        'chapainawabganj': ['Nawabganj', 'Chapai Nawabganj'],
    }
    for label in area['name'].split(' / ') + aliases.get(district_code, []):
        source_district |= Q(notes__icontains=f'\nDistrict: {label}\n') | Q(notes__iendswith=f'\nDistrict: {label}')
    imported = Q(external_id__startswith='officer:') | Q(external_id__startswith='ngoab:')
    return items.filter(Q(location__district_code=district_code) | (imported & source_district))


@transaction.atomic
def sync_crawled_contacts(officers, ngos, actor, *, publish=True, dry_run=False):
    """Upsert source-owned directory details; never create organization logins.

    Valid, reachable records may be published automatically. Records without a
    valid channel remain drafts. Missing/failed source pages never delete rows.
    """
    from django.core.validators import URLValidator
    from collections import Counter
    from shara_accounts.models import require_role

    require_role(actor, Role.SUPER_ADMIN)
    officers = list(officers)
    officer_identities = Counter((record.source_url, record.name[:160], record.designation[:160]) for record in officers)
    result = {'created': 0, 'updated': 0, 'published': 0, 'drafts': 0, 'rejected': []}
    seen = set()
    for kind, records in [('officer', officers), ('ngo', ngos)]:
        for record in records:
            external_id = f'officer:{record.officer_id}' if kind == 'officer' else f'ngoab:{record.ngo_id}'
            try:
                with transaction.atomic():
                    if external_id in seen:
                        raise ValidationError('Duplicate source identifier in the crawl.')
                    seen.add(external_id)
                    if not record.name.strip():
                        raise ValidationError('The source record has no name.')
                    URLValidator(schemes=['http', 'https'])(record.source_url)
                    existing = ResourceContact.objects.select_for_update().filter(external_id=external_id).first()
                    if kind == 'officer':
                        if not record.officer_id or len(record.officer_id) > 140:
                            raise ValidationError('Missing or oversized officer identifier.')
                        if existing is None:
                            existing = legacy_officer_contact(record.officer_id)
                        row = {
                            'officer_id': record.officer_id, 'name_en': record.name,
                            'designation_raw': record.designation, 'office': record.office,
                            'phone': ' | '.join(record.mobiles + record.phones), 'email': ' | '.join(record.emails),
                            'level': record.level, 'division': record.division, 'district': record.district,
                            'upazila': record.upazila, 'source_url': record.source_url, 'retrieved_at': record.retrieved_at,
                        }
                        candidate = _contact_from_row(row, actor, resolve_location=False)
                        if existing is None:
                            strict_office = officer_identities[(record.source_url, record.name[:160], record.designation[:160])] > 1
                            existing = legacy_officer_contact(record.officer_id, candidate=candidate, source_url=record.source_url, strict_office=strict_office)
                        candidate.notes = officer_source_notes(existing.notes if existing else '', candidate.notes, external_id)
                    else:
                        if record.source_conflict:
                            raise ValidationError(record.source_conflict)
                        if not re.fullmatch(r'\d{1,12}', record.registration_number):
                            raise ValidationError('Invalid NGO Affairs Bureau registration number.')
                        notes = [f'Crawler ID: {external_id}', f'NGO registration: {record.registration_number}',
                                 f'Source: {record.source_url}', f'Retrieved: {record.retrieved_at}']
                        for label, value in [('District', record.district), ('Country', record.country),
                                             ('Registry address', record.address), ('Website', record.website),
                                             ('Registration date', record.registration_date), ('Renewed on', record.renewed_on),
                                             ('Registry valid until', record.valid_until), ('Registry remarks', record.remarks)]:
                            if value:
                                notes.append(f'{label}: {value}')
                        candidate = ResourceContact(
                            title=record.name[:180], contact_category='ngo', institution_name=record.name[:180],
                            phone=_phone(' | '.join(record.phones)), email=_email(' | '.join(record.emails)),
                            notes='\n'.join(notes), created_by=actor, updated_by=actor,
                        )
                    contact = existing or candidate
                    if existing:
                        for field in ['title', 'contact_category', 'person_name', 'institution_name', 'designation', 'phone', 'email', 'notes']:
                            setattr(contact, field, getattr(candidate, field))
                    contact.external_id = external_id
                    contact.updated_by = actor
                    contact.is_published = bool(publish and (contact.phone or contact.email))
                    contact.full_clean()
                    if not dry_run:
                        contact.save()
                    result['updated' if existing else 'created'] += 1
                    result['published' if contact.is_published else 'drafts'] += 1
            except ValidationError as error:
                result['rejected'].append({'external_id': external_id, 'errors': error.messages})
    if dry_run:
        transaction.set_rollback(True)
    return result
