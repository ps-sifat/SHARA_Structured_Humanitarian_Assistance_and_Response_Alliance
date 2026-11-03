"""Read the user's geocode exports as data. Never execute SQL or PHP."""
import csv
import io
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

SCHEMAS = {
    'divisions': ('id','name','bn_name','url'),
    'districts': ('id','division_id','name','bn_name','lat','lon','url'),
    'upazilas': ('id','district_id','name','bn_name','url'),
    'unions': ('id','upazilla_id','name','bn_name','url'),
}


def text(value):
    return unicodedata.normalize('NFC', str(value or '').strip())


def read_export(root, table, extension):
    path = Path(root) / table / f'{table}.{extension}'
    content = path.read_text(encoding='utf-8-sig')
    columns = SCHEMAS[table]
    if extension == 'json':
        exports = [item['data'] for item in json.loads(content) if item.get('type') == 'table' and item.get('name') == table]
        if len(exports) != 1:
            raise ValueError(f'{path}: expected one {table} table.')
        rows = exports[0]
    elif extension == 'csv':
        rows = []
        for values in csv.reader(io.StringIO(content)):
            if len(values) != len(columns):
                raise ValueError(f'{path}: unexpected CSV column count.')
            rows.append(dict(zip(columns, values)))
    elif extension == 'xml':
        rows = [{column.attrib['name']: column.text or '' for column in item.findall('column')}
                for item in ET.fromstring(content).findall(f'./database/table[@name="{table}"]')]
    elif extension == 'php':
        # Match only literal exported array rows, without evaluating PHP code.
        pattern = r''' '((?:\\.|[^'\\])*)'\s*=>\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|(NULL|null)) '''.strip()
        rows = []
        for line in content.splitlines():
            if line.lstrip().startswith('array('):
                rows.append({key: (single or double).replace("\\'", "'").replace('\\\\','\\') if not null else '' for key,single,double,null in re.findall(pattern,line)})
    elif extension == 'sql':
        rows = []
        blocks = re.findall(r'INSERT\s+INTO\s+`' + table + r'`\s*\([^;]+?\)\s*VALUES\s*(.*?);', content, re.S | re.I)
        for block in blocks:
            for line in block.splitlines():
                line = line.strip().rstrip(',').strip()
                if not line:
                    continue
                if not (line.startswith('(') and line.endswith(')')):
                    raise ValueError(f'{path}: unsupported SQL export row.')
                values = next(csv.reader([line[1:-1]], quotechar="'", escapechar='\\', skipinitialspace=True))
                values = [value[1:-1] if len(value)>1 and value.startswith('"') and value.endswith('"') else value for value in values]
                if len(values) != len(columns):
                    raise ValueError(f'{path}: unexpected SQL column count.')
                rows.append(dict(zip(columns, values)))
    else:
        raise ValueError('Supported formats: csv, json, xml, sql, php.')
    result = {}
    for row in rows:
        if set(row) != set(columns):
            raise ValueError(f'{path}: unexpected columns for ID {row.get("id")}: {sorted(row)}; expected {list(columns)}.')
        row = {key: text(value) for key,value in row.items()}
        if not row['id'].isdigit() or row['id'] in result or not row['name'] or not row['bn_name']:
            raise ValueError(f'{path}: missing name or duplicate/invalid ID {row.get("id")}.')
        result[row['id']] = row
    if not result:
        raise ValueError(f'{path}: no data rows found.')
    return result


def compare_exports(root):
    selected, report = {}, {'selected_format':'csv', 'tables':{}}
    for table in SCHEMAS:
        exports = {extension:read_export(root,table,extension) for extension in ['csv','json','xml','sql','php']}
        selected[table] = exports['csv']
        differences = []
        for extension,rows in exports.items():
            if extension == 'csv':
                continue
            for code in sorted(set(rows) | set(exports['csv']), key=int):
                actual, expected = rows.get(code), exports['csv'].get(code)
                if actual is None or expected is None:
                    differences.append({'format':extension,'id':code,'issue':'missing_in_format' if actual is None else 'only_in_format'})
                else:
                    for field in SCHEMAS[table]:
                        if actual[field] != expected[field]:
                            differences.append({'format':extension,'id':code,'field':field,'csv':expected[field],'other':actual[field]})
        report['tables'][table] = {'counts':{extension:len(rows) for extension,rows in exports.items()},'differences':differences}
    # Relationships are validated using the repository's IDs, never name alone.
    for child,parent,foreign_key in [('districts','divisions','division_id'),('upazilas','districts','district_id'),('unions','upazilas','upazilla_id')]:
        for row in selected[child].values():
            if row[foreign_key] not in selected[parent]:
                raise ValueError(f'Orphan {child} ID {row["id"]}: unknown {foreign_key}.')
    return selected, report


def bilingual(row):
    return f'{row["bn_name"]} / {row["name"]}'


def build_catalogue(rows):
    divisions = {code:{'name':bilingual(row)} for code,row in rows['divisions'].items()}
    districts, district_ids, upazila_ids, unions = {}, {}, {}, {}
    for code,row in rows['districts'].items():
        # Preserve SHARA's existing whole-district matching keys.
        slug = 'barishal' if code == '33' else re.sub(r'[^a-z0-9]+','-',row['name'].lower()).strip('-')
        if slug in districts:
            raise ValueError(f'Duplicate district key: {slug}')
        district_ids[code] = slug
        districts[slug] = {'source_id':code,'name':bilingual(row),'division_code':row['division_id'],'upazilas':{}}
    for code,row in rows['upazilas'].items():
        district = district_ids[row['district_id']]
        upazila_code = f'{district}-{code}'
        districts[district]['upazilas'][upazila_code] = bilingual(row)
        upazila_ids[code] = upazila_code
        unions[upazila_code] = {}
    for code,row in rows['unions'].items():
        unions[upazila_ids[row['upazilla_id']]][code] = bilingual(row)
    return {'source':{'name':'bangladesh-geocode-master','author':'Nuhil Mehdy','license':'MIT','format':'csv',
                      'counts':{table:len(values) for table,values in rows.items()},
                      'note':'IDs and spellings come from the uploaded dataset; not a claim of current official national coverage.'},
            'divisions':divisions,'districts':districts,'unions':unions}


import json
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Compare the five uploaded export formats and bundle validated CSV geography (no database writes).'

    def add_arguments(self, parser):
        parser.add_argument('source', nargs='?', default=str(settings.BASE_DIR.parent / 'bangladesh-geocode-master'))

    def handle(self, *args, **options):
        source = Path(options['source'])
        try:
            rows, report = compare_exports(source)
            result = build_catalogue(rows)
            license_text = (source / 'LICENSE').read_text(encoding='utf-8')
        except (ValueError, OSError) as error:
            raise CommandError(str(error))
        target = settings.BASE_DIR / 'geo_locations' / 'data'
        target.mkdir(exist_ok=True)
        (target / 'bangladesh.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (target / 'source_comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (target / 'LICENSE.bangladesh-geocode.txt').write_text(license_text,encoding='utf-8')
        for table,info in report['tables'].items():
            self.stdout.write(f'{table}: {info["counts"]}; differences against CSV: {len(info["differences"])}')
        self.stdout.write(self.style.SUCCESS(f'Validated catalogue written to {target}. Database unchanged.'))
