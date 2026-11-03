from django.core.exceptions import ValidationError
from django.db import models

from Sara.domain import DomainModel


class Location(DomainModel):
    class Kind(models.TextChoices):
        DIVISION = 'division', 'বিভাগ / Division'
        DISTRICT = 'district', 'জেলা / District'
        UPAZILA = 'upazila', 'উপজেলা / Upazila'
        UNION = 'union', 'ইউনিয়ন / Union'
        ADDRESS = 'address', 'ঠিকানা / Address'

    kind = models.CharField(max_length=10, choices=Kind.choices)
    division_code = models.CharField(max_length=32, blank=True)
    division = models.CharField(max_length=100, blank=True)
    district_code = models.CharField(max_length=32, blank=True)
    district = models.CharField(max_length=100, blank=True)
    upazila_code = models.CharField(max_length=64, blank=True)
    upazila = models.CharField(max_length=100, blank=True)
    union = models.CharField(max_length=120, blank=True)
    union_code = models.CharField(max_length=32, blank=True)
    village = models.CharField(max_length=160, blank=True)
    landmark = models.CharField(max_length=200, blank=True)
    directions = models.TextField(blank=True)

    class Meta:
        ordering = ['district', 'upazila']
        constraints = [
            models.UniqueConstraint(fields=['division_code'], condition=models.Q(kind='division'), name='canonical_division_unique'),
            models.UniqueConstraint(fields=['district_code'], condition=models.Q(kind='district'), name='canonical_district_unique'),
            models.UniqueConstraint(fields=['upazila_code'], condition=models.Q(kind='upazila'), name='canonical_upazila_unique'),
            models.UniqueConstraint(fields=['union_code'], condition=models.Q(kind='union'), name='canonical_union_unique'),
            models.CheckConstraint(condition=(
                models.Q(kind='division',district_code='',district='',upazila_code='',upazila='',union_code='',union='',village='',landmark='',directions='') & ~models.Q(division_code='') & ~models.Q(division='')
                | models.Q(kind='district',upazila_code='',upazila='',union_code='',union='',village='',landmark='',directions='') & ~models.Q(district_code='') & ~models.Q(district='')
                | models.Q(kind='upazila',union_code='',union='',village='',landmark='',directions='') & ~models.Q(district_code='') & ~models.Q(district='') & ~models.Q(upazila_code='') & ~models.Q(upazila='')
                | models.Q(kind='union',village='',landmark='',directions='') & ~models.Q(district_code='') & ~models.Q(district='') & ~models.Q(upazila_code='') & ~models.Q(upazila='') & ~models.Q(union_code='') & ~models.Q(union='')
                | models.Q(kind='address') & ~models.Q(district_code='') & ~models.Q(district='') & ~models.Q(upazila_code='') & ~models.Q(upazila='')
            ), name='location_kind_shape'),
        ]

    def clean(self):
        from .models import catalogue, geography_data, union_choices
        divisions = geography_data()['divisions']
        if self.kind == self.Kind.DIVISION:
            if self.division_code not in divisions:
                raise ValidationError({'division_code':'অবৈধ বিভাগ। / Invalid division.'})
            self.division = divisions[self.division_code]['name']
            if any(getattr(self, field) for field in ['district_code','district','upazila_code','upazila','union_code','union','village','landmark','directions']):
                raise ValidationError('A division reference cannot contain lower-level or private address fields.')
            return
        area = catalogue().get(self.district_code)
        if not area or self.district and self.district != area['name']:
            raise ValidationError('অবৈধ জেলা। / Invalid district selection.')
        self.district = area['name']
        self.division_code = area.get('division_code','')
        self.division = divisions.get(self.division_code,{}).get('name','')
        if self.kind in [self.Kind.ADDRESS,self.Kind.UPAZILA,self.Kind.UNION]:
            expected = area['upazilas'].get(self.upazila_code)
            if not expected or self.upazila and self.upazila != expected:
                raise ValidationError('জেলার সাথে উপজেলা মেলেনি। / Upazila does not match the district.')
            self.upazila = expected
        if self.kind == self.Kind.UNION or self.union_code:
            expected = union_choices(self.district_code,self.upazila_code).get(self.union_code)
            if not expected or self.union and self.union != expected:
                raise ValidationError('উপজেলার সাথে ইউনিয়ন মেলেনি। / Union does not match the upazila.')
            self.union = expected
        if self.kind == self.Kind.DISTRICT and any(getattr(self, f) for f in ('upazila_code','upazila','union_code','union','village','landmark','directions')):
            raise ValidationError('District references cannot contain lower-level or private address fields.')
        if self.kind == self.Kind.UPAZILA and (self.union_code or self.union):
            raise ValidationError('Upazila references cannot contain union fields.')
        if self.kind != self.Kind.ADDRESS and any([self.village,self.landmark,self.directions]):
            raise ValidationError('Reference locations cannot contain private address details.')

    def get_full_address(self):
        return ', '.join(filter(None, [self.directions, self.landmark, self.village, self.union, self.upazila, self.district]))

    def validate_kind(self):
        self.full_clean()

    def matches_district(self, code):
        return self.district_code == code

    def __str__(self):
        if self.kind == self.Kind.DIVISION:
            return self.division
        return ', '.join(filter(None, [self.union if self.kind == self.Kind.UNION else '', self.upazila, self.district]))

# Catalogue
"""Validated geography bundled from the user-supplied geocode repository."""
import json
from functools import lru_cache
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


@lru_cache(maxsize=1)
def geography_data():
    path = getattr(settings, 'SHARA_GEOGRAPHY_FILE', '') or Path(__file__).with_name('data') / 'bangladesh.json'
    try:
        with open(path, encoding='utf-8-sig') as source:
            data = json.load(source)
    except (OSError, ValueError) as error:
        raise ImproperlyConfigured(f'Cannot load geographic catalogue: {error}') from error
    if 'districts' not in data:
        data = {'districts':data, 'divisions':{}, 'unions':{}}
    data.setdefault('divisions', {})
    data.setdefault('unions', {})
    areas = data['districts']
    if not isinstance(areas, dict) or not areas:
        raise ImproperlyConfigured('Geographic catalogue must contain districts.')
    seen = set()
    for code, district in areas.items():
        if not code or not district.get('name') or not isinstance(district.get('upazilas'), dict) or not district['upazilas']:
            raise ImproperlyConfigured('Each district requires a name and an upazilas mapping.')
        for upazila_code, name in district['upazilas'].items():
            if upazila_code in seen or not name:
                raise ImproperlyConfigured('Upazila codes must be unique and named.')
            seen.add(upazila_code)
    return data


@lru_cache(maxsize=1)
def catalogue():
    return geography_data()['districts']


def union_choices(district_code, upazila_code):
    if upazila_code not in catalogue().get(district_code, {}).get('upazilas', {}):
        return {}
    return geography_data()['unions'].get(upazila_code, {})


# Importer
"""Import references into Location while preserving existing address UUIDs."""
from collections import Counter
import re
import unicodedata
from django.core.exceptions import ValidationError
from django.db import transaction

GEOGRAPHIC_FIELDS = ('division_code','division','district_code','district','upazila_code','upazila','union_code','union')


def normalized_name(value):
    value = re.sub(r'\([^)]*\)', '', value or '')
    return ''.join(char for char in unicodedata.normalize('NFC',value).casefold() if char.isalnum())


def labels_match(value, label):
    return normalized_name(value) in {normalized_name(part) for part in label.split(' / ')}


def reference_rows():
    data = geography_data()
    for code,area in data['divisions'].items():
        yield Location(kind='division', division_code=code, division=area['name'])
    for code,area in catalogue().items():
        yield Location(kind='district', district_code=code, district=area['name'])
        for upazila_code,name in area['upazilas'].items():
            yield Location(kind='upazila',district_code=code,district=area['name'],upazila_code=upazila_code,upazila=name)
            for union_code,union_name in union_choices(code,upazila_code).items():
                yield Location(kind='union',district_code=code,district=area['name'],upazila_code=upazila_code,upazila=name,union_code=union_code,union=union_name)


def reference_key(row):
    field = {'division':'division_code','district':'district_code','upazila':'upazila_code','union':'union_code'}.get(row.kind)
    return (row.kind,getattr(row,field)) if field else None


def match_existing(row):
    if row.kind == 'division':
        row.full_clean(validate_unique=False,validate_constraints=False)
        return
    areas = catalogue()
    if row.district_code not in areas:
        matches = [code for code,area in areas.items() if labels_match(row.district,area['name'])]
        if len(matches) != 1:
            raise ValidationError(f'Cannot unambiguously match district for Location {row.pk}.')
        row.district_code = matches[0]
    area = areas[row.district_code]
    row.district = area['name']
    if row.kind in ['address','upazila','union']:
        if row.upazila_code not in area['upazilas']:
            # Known orthographic differences in the old supplied UI.
            aliases = {'সীতাকুণ্ড':'সীতাকুন্ড','কেরানীগঞ্জ':'কেরাণীগঞ্জ','গঙ্গাচড়া':'গংগাচড়া'}
            name = aliases.get(row.upazila,row.upazila)
            matches = [code for code,label in area['upazilas'].items() if labels_match(name,label)]
            if len(matches) != 1:
                raise ValidationError(f'Cannot unambiguously match upazila for Location {row.pk}.')
            row.upazila_code = matches[0]
        row.upazila = area['upazilas'][row.upazila_code]
        if row.union_code:
            label = union_choices(row.district_code,row.upazila_code).get(row.union_code)
            if not label:
                raise ValidationError(f'Unknown union for Location {row.pk}.')
            row.union = label
        elif row.union:
            matches = [(code,label) for code,label in union_choices(row.district_code,row.upazila_code).items() if labels_match(row.union,label)]
            if len(matches) == 1:
                row.union_code,row.union = matches[0]
    row.full_clean(validate_unique=False,validate_constraints=False)


def import_locations(*, database='default', dry_run=False):
    with transaction.atomic(using=database):
        return _import_locations(database=database,dry_run=dry_run)


def _import_locations(*, database, dry_run):
    # The configured SQLite IMMEDIATE transaction serializes imports and writes.
    # Existing UUIDs and coverage join rows are never replaced or deleted.
    existing = list(Location.objects.using(database).select_for_update().all())
    index, updates = {}, []
    for row in existing:
        before = tuple(getattr(row,field) for field in GEOGRAPHIC_FIELDS)
        match_existing(row)
        key = reference_key(row)
        if key:
            if key in index:
                raise ValidationError(f'Two existing Location rows match reference {key}; resolve the duplicate before import.')
            index[key] = row
        if before != tuple(getattr(row,field) for field in GEOGRAPHIC_FIELDS):
            updates.append(row)
    additions, totals = [], Counter()
    for row in reference_rows():
        row.full_clean(validate_unique=False,validate_constraints=False)
        totals[row.kind] += 1
        if reference_key(row) not in index:
            additions.append(row)
    if not dry_run:
        with transaction.atomic(using=database):
            if updates:
                Location.objects.using(database).bulk_update(updates,GEOGRAPHIC_FIELDS,batch_size=100)
            Location.objects.using(database).bulk_create(additions,batch_size=250)
    return {'references':dict(totals),'create':len(additions),'update_existing':len(updates),'dry_run':dry_run}
