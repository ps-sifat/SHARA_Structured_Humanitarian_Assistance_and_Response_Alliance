"""Display metadata for directory cards, including legacy CSV source notes."""
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator


def contact_card(contact):
    metadata = {}
    notes = []
    imported = bool(contact.external_id) or 'CSV officer_id:' in contact.notes
    for line in contact.notes.splitlines():
        key, separator, value = line.partition(':')
        if imported and separator and key in {
            'CSV officer_id', 'Crawler ID', 'Level', 'Designation code', 'Source', 'Retrieved',
            'Office', 'Division', 'District', 'Upazila',
        }:
            metadata[key] = value.strip()
        else:
            notes.append(line)
    source = metadata.get('Source', '')
    try:
        URLValidator(schemes=['http', 'https'])(source)
    except ValidationError:
        source = ''
    area = str(contact.location) if contact.location else ''
    if not area:
        area = ' · '.join(filter(None, [metadata.get('District'), metadata.get('Division')]))
    return {
        'name': contact.person_name or contact.title,
        'initial': (contact.person_name or contact.title)[:1],
        'area': area,
        'source_url': source,
        'source_host': urlsplit(source).hostname if source else '',
        'notes': '\n'.join(notes).strip(),
    }


from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.contrib import messages
from django.db import IntegrityError, transaction
from django.shortcuts import redirect,get_object_or_404,render
from Sara.domain import Role
from Sara.web import page,form_groups,conflict,saved,record_id
from shara_accounts.models import role_required
from geo_locations.forms import AddressForm
from .models import ResourceContact
from .forms import ResourceContactForm
from .models import save_contact,contact_action,publish_all_contacts,search_contacts,filter_contact_district
from .views import contact_card


def contact_batch(request, items, manage_contacts=False):
    contacts_page = Paginator(items.order_by('title', 'pk'), 50).get_page(request.GET.get('page'))
    query = request.GET.copy()
    query.pop('edit', None)
    query.pop('fragment', None)
    query['page'] = contacts_page.next_page_number() if contacts_page.has_next() else 1
    contacts = list(contacts_page.object_list)
    for contact in contacts:
        contact.card = contact_card(contact)
    return {
        'contacts': contacts,
        'contacts_page': contacts_page,
        'contacts_total': contacts_page.paginator.count,
        'contacts_next': '?' + query.urlencode() if contacts_page.has_next() else '',
        'manage_contacts': manage_contacts,
    }


def index(request):
    items=ResourceContact.objects.filter(is_published=True).select_related('location')
    items = search_contacts(items, request.GET.get('search', ''))
    if request.GET.get('category'):
        items=items.filter(contact_category=request.GET['category'])
    if request.GET.get('district'):
        items=filter_contact_district(items, request.GET['district'])
    batch = contact_batch(request, items)
    if request.GET.get('fragment') == 'contacts':
        return render(request, 'shared/contact_batch.html', batch)
    return page(request,'resources/resources.html','সহায়তার যোগাযোগ / Resource contacts',**batch,categories=ResourceContact.CATEGORIES)


@role_required(Role.SUPER_ADMIN)
def manage(request):
    contact=None
    if request.GET.get('edit'):
        contact=get_object_or_404(ResourceContact,pk=record_id(request.GET['edit']))
    form=ResourceContactForm(request.POST if request.method=='POST' and request.POST.get('action')=='save' else None,instance=contact)
    address=AddressForm(request.POST if request.method=='POST' and request.POST.get('action')=='save' else None,prefix='address',location=contact.location if contact else None,optional=True)
    if request.method=='POST':
        action=request.POST.get('action')
        if action == 'publish_all':
            published, skipped = publish_all_contacts(request.user)
            messages.success(request, f'প্রকাশিত / Published: {published}. সংশোধনের জন্য খসড়ায় রাখা হয়েছে / Kept as drafts for correction: {skipped}.')
            return redirect('admin_resources')
        elif action=='save' and all([form.is_valid(),address.is_valid()]):
            try:
                with transaction.atomic():
                    save_contact(request.user,{**form.cleaned_data,'location':address.save()},contact.pk if contact else None)
                saved(request)
                return redirect('admin_resources')
            except (ValidationError,IntegrityError) as error:
                conflict(form,error)
        elif action in ['publish','hide','remove']:
            contact=get_object_or_404(ResourceContact,pk=record_id(request.POST.get('contact')))
            try:
                contact_action(request.user,contact.pk,action)
                saved(request)
                return redirect('admin_resources')
            except ValidationError as error:
                conflict(form,error)
    batch = contact_batch(request, ResourceContact.objects.select_related('location'), manage_contacts=True)
    if request.method == 'GET' and request.GET.get('fragment') == 'contacts':
        return render(request, 'shared/contact_batch.html', batch)
    return page(request,'admin_resources/admin_resources.html','যোগাযোগ পরিচালনা / Manage resource contacts',**batch,groups=form_groups(('যোগাযোগ / Contact',form),('ঠিকানা (ঐচ্ছিক) / Address (optional)',address)))
