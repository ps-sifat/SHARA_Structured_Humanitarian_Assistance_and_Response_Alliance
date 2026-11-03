import uuid
from django.contrib import messages
from django.core import signing
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse
from Sara.domain import Role, ACTIVE_MISSIONS
from Sara.forms import ReasonForm
from Sara.web import page, form_groups, conflict, saved, request_summary, mission_summary
from shara_accounts.models import role_required, own_organization
from geo_locations.forms import AddressForm
from missions.models import Mission
from missions.forms import AssignmentForm
from missions.models import assign_mission
from missions.models import require_request_review
from .models import HelpRequest
from .forms import HelpRequestForm, TrackingForm, ResponseForm, ClarificationForm, PriorityForm
from .models import submit_request, respond_to_clarification, request_clarification, reject_request, override_priority, requests_for_phone


def home(request):
    from volunteers.models import VolunteerProfile
    from organizations.models import Organization
    return page(request,'home/home.html','মানুষের পাশে মানুষ / People helping people',completed_count=HelpRequest.objects.filter(status='completed').count(),volunteer_count=VolunteerProfile.objects.filter(user__is_active=True).count(),organization_count=Organization.objects.filter(verification_status='approved').count())


def apply(request):
    token = request.session.get('submission_token')
    if not token:
        token=str(uuid.uuid4())
        request.session['submission_token']=token
    form=HelpRequestForm(request.POST or None,initial={'submission_token':token})
    address=AddressForm(request.POST or None,prefix='address',directions_required=True)
    result=None
    if request.method=='POST' and all([form.is_valid(),address.is_valid()]):
        if form.cleaned_data['submission_token'] != token:
            form.add_error(None,'ফর্মটি মেয়াদোত্তীর্ণ। পাতা রিফ্রেশ করুন। / Form expired. Refresh the page.')
        else:
            try:
                with transaction.atomic():
                    data={k:v for k,v in form.cleaned_data.items() if k!='submission_token'}
                    data['submission_key']=uuid.UUID(token)
                    item,code=submit_request(data,address.save(),request.user)
                if code is None:
                    messages.info(request,'এই আবেদন ইতোমধ্যে গৃহীত। আবেদনে দেওয়া ফোন নম্বর দিয়ে খুঁজুন। / Already received. Track using the phone number in your request.')
                    return redirect('track')
                result={'reference':item.reference}
                # Keep the nonce until another GET so a repeated POST is harmless.
            except (ValidationError,IntegrityError) as error:
                conflict(form,error)
    if request.method=='GET':
        request.session['submission_token']=str(uuid.uuid4())
        form.initial['submission_token']=request.session['submission_token']
    response=page(request,'apply/apply.html','সাহায্যের আবেদন / Request help',groups=form_groups(('অবস্থান / Location',address),('সহায়তা ও যোগাযোগ / Assistance and contact',form)),result=result)
    response['Cache-Control']='no-store'
    return response


def track(request):
    responding = request.method == 'POST' and request.POST.get('action') == 'respond'
    looking_up = request.method == 'POST' and not responding
    form = TrackingForm(request.POST if looking_up else None)
    response_form = ResponseForm(request.POST if responding else None)
    phone = request.session.get('tracking_phone')
    if looking_up:
        request.session.pop('tracking_phone', None)
        request.session.pop('tracking_grant', None)
        phone = None
        if form.is_valid():
            request.session['tracking_phone'] = form.cleaned_data['phone']
            return redirect('track')
    items = requests_for_phone(phone) if phone else HelpRequest.objects.none()
    response_id = None
    if responding:
        response_id = request.POST.get('request_id', '')
        item = next((item for item in items if str(item.pk) == response_id), None)
        if item is None:
            response_form.add_error(None, 'ফোন নম্বর দিয়ে আবার খুঁজুন। / Look up your phone number again.')
        elif response_form.is_valid():
            grant = signing.dumps({'id': str(item.pk), 'hash': item.tracking_code_hash}, salt='shara-tracking')
            try:
                respond_to_clarification(item.pk, response_form.cleaned_data['response'], tracking_grant=grant)
                saved(request)
                return redirect('track')
            except ValidationError as error:
                conflict(response_form, error)
    records = []
    for item in items:
        item_response_form = response_form if str(item.pk) == response_id else ResponseForm()
        item_response_form.auto_id = f'id_response_{item.pk}_%s'
        records.append({
            **request_summary(item), 'id': str(item.pk), 'created_at': item.created_at,
            'question': item.clarification_question, 'response': item.clarification_response,
            'rejection_reason': item.rejection_reason, 'needs_response': item.status == 'clarification_needed',
            'response_form': item_response_form,
            'attempts': [{'number': m.attempt_number, 'stage': m.get_status_display()} for m in item.missions.all()],
        })
    response = page(request, 'track/track.html', 'আবেদন ট্র্যাক / Track request',
                    form=form, records=records, searched=bool(phone), response_form=response_form)
    response['Cache-Control'] = 'no-store'
    return response


def filtered_requests(request,items):
    for key,field in [('district','location__district_code'),('status','status'),('priority','priority')]:
        if request.GET.get(key):
            items=items.filter(**{field:request.GET[key]})
    if request.GET.get('search'):
        term=request.GET['search'][:100]
        items=items.filter(Q(reference__icontains=term)|Q(location__district__icontains=term)|Q(location__upazila__icontains=term))
    if request.GET.get('need'):
        # Portable JSON-list filtering without exposing a generic location API.
        ids=[item.pk for item in items if request.GET['need'] in item.need_categories]
        items=items.filter(pk__in=ids)
    return items


@role_required(Role.VOLUNTEER,Role.ORGANIZATION_ADMIN,Role.SUPER_ADMIN,approved=True)
def index(request):
    items=HelpRequest.objects.select_related('location').all()
    role=request.user.role
    if role=='organization_admin':
        items=items.filter(status__in=['pending','clarification_needed'])
    elif role=='volunteer':
        items=items.filter(status__in=['pending','clarification_needed'])
    items=filtered_requests(request,items)
    prefix={'volunteer':'volunteer','organization_admin':'org','super_admin':'admin'}[role]
    records=[request_summary(item,reverse(prefix+'_request_detail',args=[item.pk]) if role!='volunteer' else None) for item in items]
    return page(request,f'{prefix}_requests/{prefix}_requests.html','সাহায্যের আবেদন / Help requests',records=records,request_filters=True)


@role_required(Role.ORGANIZATION_ADMIN,Role.SUPER_ADMIN,approved=True)
def detail(request,id):
    item=get_object_or_404(HelpRequest.objects.select_related('location'),pk=id)
    require_request_review(request.user,item)
    action=request.POST.get('action') if request.method=='POST' else None
    assignment=AssignmentForm(request.POST if action=='assign' else None,actor=request.user,help_request=item)
    clarification=ClarificationForm(request.POST if action=='clarify' else None)
    rejection=ReasonForm(request.POST if action=='reject' else None)
    priority=PriorityForm(request.POST if action=='priority' else None,initial={'priority':item.priority})
    forms={'assign':assignment,'clarify':clarification,'reject':rejection,'priority':priority}
    if request.method=='POST':
        if action in ['reject','priority'] and request.user.role!=Role.SUPER_ADMIN:
            raise PermissionDenied
        if action not in forms:
            raise PermissionDenied
        form=forms[action]
        if form.is_valid():
            try:
                if action=='assign':
                    kind,pk=form.cleaned_data['target'].split(':',1)
                    assign_mission(request.user,item.pk,**{'team_id' if kind=='team' else 'volunteer_id':pk})
                elif action=='clarify':
                    request_clarification(request.user,item.pk,form.cleaned_data['question'])
                elif action=='reject':
                    reject_request(request.user,item.pk,form.cleaned_data['reason'])
                elif action=='priority':
                    override_priority(request.user,item.pk,form.cleaned_data['priority'] or None,form.cleaned_data['reason'])
                saved(request)
                return redirect(request.path)
            except (ValidationError,IntegrityError) as error:
                conflict(form,error)
    prefix='admin' if request.user.role==Role.SUPER_ADMIN else 'org'
    risks=[item._meta.get_field(name).verbose_name for name in ['immediate_rescue_required','trapped_person','critical_medical_emergency','injured_person','child_in_danger','elderly_in_danger'] if getattr(item,name)]
    return page(request,f'{prefix}_request_detail/{prefix}_request_detail.html','আবেদনের বিবরণ / Request detail',summary=request_summary(item),private={'phone':item.contact_phone,'address':item.location.get_full_address(),'name':item.victim_name,'note':item.emergency_condition,'reporter_name':item.reporter_name,'reporter_phone':item.reporter_phone,'relationship':item.reporter_relationship},assignment=assignment,clarification=clarification,rejection=rejection,priority_form=priority,is_super=request.user.role==Role.SUPER_ADMIN,pending=item.status=='pending',open_request=item.status not in ['completed','rejected'],question=item.clarification_question,clarification_response=item.clarification_response,rejection_reason=item.rejection_reason,suggested=item.get_suggested_priority_display(),override_reason=item.priority_override_reason,risks=risks,attempts=[mission_summary(m,reverse(prefix+'_mission_detail',args=[m.pk])) for m in item.missions.all()])
