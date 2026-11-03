from django.contrib.auth import login
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse
from Sara.domain import Role, ACTIVE_MISSIONS
from Sara.forms import ReasonForm
from Sara.web import page, form_groups, conflict, saved, record_id
from shara_accounts.forms import RegistrationForm
from shara_accounts.models import role_required, own_organization
from geo_locations.forms import AddressForm, save_districts
from volunteers.models import VolunteerProfile
from .models import Organization
from .forms import OrganizationForm
from .models import review_organization, resubmit_organization, save_organization, decide_membership, end_membership


def register(request):
    account = RegistrationForm(request.POST or None,prefix='account')
    address = AddressForm(request.POST or None,prefix='address')
    form = OrganizationForm(request.POST or None,request.FILES or None,prefix='organization')
    if request.method == 'POST' and all([account.is_valid(),address.is_valid(),form.is_valid()]):
        try:
            with transaction.atomic():
                user = account.save(Role.ORGANIZATION_ADMIN)
                data = {k:v for k,v in form.cleaned_data.items() if k not in ['districts','remove_photo']}
                organization = Organization.objects.create(administrator=user,office_location=address.save(),**data)
                organization.operating_districts.set(save_districts(form.cleaned_data['districts']))
            login(request,user,backend='shara_accounts.backends.PhoneEmailBackend')
            saved(request)
            return redirect('org_dashboard')
        except (ValidationError,IntegrityError) as error:
            conflict(form,error)
    return page(request,'organization_register/organization_register.html','সংগঠন নিবন্ধন / Organization registration',groups=form_groups(('প্রশাসকের অ্যাকাউন্ট / Administrator account',account),('অফিসের ঠিকানা / Office address',address),('সংগঠন / Organization',form)))


@role_required(Role.ORGANIZATION_ADMIN)
def dashboard(request):
    org = own_organization(request.user,approved=False)
    form = ReasonForm(request.POST or None)
    form.fields['reason'].required=False
    if request.method == 'POST' and form.is_valid():
        try:
            resubmit_organization(request.user)
            saved(request)
            return redirect('org_dashboard')
        except ValidationError as error:
            conflict(form,error)
    return page(request,'org_dashboard/org_dashboard.html','সংগঠনের ড্যাশবোর্ড / Organization dashboard',organization=org,form=form,member_count=org.membership_profiles.filter(membership_status='approved').count(),team_count=org.teams.count(),mission_count=org.supervised_missions.filter(status__in=ACTIVE_MISSIONS).count())


@role_required(Role.ORGANIZATION_ADMIN)
def profile(request):
    org = own_organization(request.user,approved=False)
    initial = {name:getattr(org,name) for name in ['name','organization_type','description','contact_phone','contact_email','logo']}
    initial['districts'] = list(org.operating_districts.values_list('district_code',flat=True))
    form = OrganizationForm(request.POST or None,request.FILES or None,initial=initial)
    address = AddressForm(request.POST or None,prefix='address',location=org.office_location)
    if request.method == 'POST' and all([form.is_valid(),address.is_valid()]):
        try:
            with transaction.atomic():
                data = {k:v for k,v in form.cleaned_data.items() if k not in ['districts','remove_photo']}
                if form.cleaned_data['remove_photo']:
                    data['logo'] = ''
                elif not data.get('logo'):
                    data.pop('logo',None)
                data['office_location']=address.save()
                save_organization(request.user,data,save_districts(form.cleaned_data['districts']))
            saved(request)
            return redirect('org_profile')
        except (ValidationError,IntegrityError) as error:
            conflict(form,error)
    return page(request,'org_profile/org_profile.html','সংগঠনের প্রোফাইল / Organization profile',groups=form_groups(('অফিসের ঠিকানা / Office address',address),('সংগঠন / Organization',form)),photo=org.logo)


@role_required(Role.ORGANIZATION_ADMIN,approved=True)
def memberships(request, approved_members=False):
    org = own_organization(request.user)
    form = ReasonForm(request.POST or None)
    form.fields['reason'].required=False
    if request.method == 'POST' and form.is_valid():
        # Fetch through own scope first, including forged IDs.
        profile = get_object_or_404(org.membership_profiles,pk=record_id(request.POST.get('profile')))
        try:
            if approved_members:
                end_membership(request.user,profile.pk,reason=form.cleaned_data['reason'])
            else:
                decide_membership(request.user,profile.pk,request.POST.get('action'),form.cleaned_data['reason'])
            saved(request)
            return redirect('org_volunteers' if approved_members else 'org_memberships')
        except ValidationError as error:
            conflict(form,error)
    rows = org.membership_profiles.filter(membership_status='approved' if approved_members else 'pending').select_related('user')
    return page(request, 'org_volunteers/org_volunteers.html' if approved_members else 'org_memberships/org_memberships.html','সদস্য / Members' if approved_members else 'সদস্যতার আবেদন / Membership applications',members=rows,form=form,approved_members=approved_members)


@role_required(Role.SUPER_ADMIN)
def review(request):
    form = ReasonForm(request.POST or None)
    form.fields['reason'].required=False
    if request.method == 'POST' and form.is_valid():
        org = get_object_or_404(Organization,pk=record_id(request.POST.get('organization')))
        try:
            review_organization(request.user,org.pk,request.POST.get('action'),form.cleaned_data['reason'])
            saved(request)
            return redirect('admin_organizations')
        except ValidationError as error:
            conflict(form,error)
    organizations = Organization.objects.select_related('office_location','administrator').all()
    if request.GET.get('status'):
        organizations=organizations.filter(verification_status=request.GET['status'])
    return page(request,'admin_organizations/admin_organizations.html','সংগঠন পর্যালোচনা / Organization review',organizations=organizations,form=form)
