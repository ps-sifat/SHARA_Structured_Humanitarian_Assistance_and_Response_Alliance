from django.contrib.auth import login
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse
from Sara.domain import Role, ACTIVE_MISSIONS
from Sara.web import page, form_groups, conflict, saved, mission_summary
from shara_accounts.forms import RegistrationForm
from shara_accounts.models import role_required
from geo_locations.forms import AddressForm, save_districts
from organizations.models import Organization
from organizations.models import apply_membership, end_membership
from response_teams.models import leave_team
from missions.models import visible_missions
from .models import VolunteerProfile
from .forms import VolunteerForm
from .models import save_profile


def register(request):
    account = RegistrationForm(request.POST or None, prefix='account')
    address = AddressForm(request.POST or None, prefix='address')
    form = VolunteerForm(request.POST or None, request.FILES or None, prefix='profile', initial={'availability':'available'})
    # Registration may optionally request one approved organization.
    from django import forms
    form.fields['organization'] = forms.ModelChoiceField(label='সংগঠন / Organization (optional)', required=False, queryset=Organization.objects.filter(verification_status='approved'))
    if request.method == 'POST' and all([account.is_valid(), address.is_valid(), form.is_valid()]):
        try:
            with transaction.atomic():
                user = account.save(Role.VOLUNTEER)
                data = {k:v for k,v in form.cleaned_data.items() if k not in ['districts','remove_photo','organization']}
                profile = VolunteerProfile.objects.create(user=user, current_location=address.save(), **data)
                profile.operating_districts.set(save_districts(form.cleaned_data['districts']))
                if form.cleaned_data['organization']:
                    apply_membership(user, form.cleaned_data['organization'].pk)
            login(request,user,backend='shara_accounts.backends.PhoneEmailBackend')
            saved(request)
            return redirect('volunteer_dashboard')
        except (ValidationError, IntegrityError) as error:
            conflict(form,error)
    return page(request,'volunteer_register/volunteer_register.html','স্বেচ্ছাসেবক নিবন্ধন / Volunteer registration',groups=form_groups(('অ্যাকাউন্ট / Account',account),('বর্তমান ঠিকানা / Current address',address),('স্বেচ্ছাসেবা / Volunteering',form)))


@role_required(Role.VOLUNTEER)
def dashboard(request):
    profile = get_object_or_404(VolunteerProfile,user=request.user)
    missions = visible_missions(request.user).filter(status__in=ACTIVE_MISSIONS).select_related('help_request__location','assigned_team','assigned_volunteer__user')
    return page(request,'volunteer_dashboard/volunteer_dashboard.html','স্বেচ্ছাসেবক / Volunteer dashboard',profile=profile,records=[mission_summary(m,reverse('volunteer_mission_detail',args=[m.pk])) for m in missions])


@role_required(Role.VOLUNTEER)
def profile(request):
    profile = get_object_or_404(VolunteerProfile,user=request.user)
    initial = {name:getattr(profile,name) for name in ['skills','assistance_capabilities','availability','vehicle_access','swimming_capability']}
    initial['districts'] = list(profile.operating_districts.values_list('district_code',flat=True))
    initial['profile_photo'] = profile.profile_photo
    form = VolunteerForm(request.POST or None,request.FILES or None,initial=initial)
    address = AddressForm(request.POST or None,prefix='address',location=profile.current_location)
    if request.method == 'POST' and all([form.is_valid(),address.is_valid()]):
        try:
            with transaction.atomic():
                data = {k:v for k,v in form.cleaned_data.items() if k not in ['districts','remove_photo']}
                if form.cleaned_data['remove_photo']:
                    data['profile_photo'] = ''
                elif not data.get('profile_photo'):
                    data.pop('profile_photo',None)
                data['current_location'] = address.save()
                save_profile(request.user,data,save_districts(form.cleaned_data['districts']))
            saved(request)
            return redirect('volunteer_profile')
        except (ValidationError,IntegrityError) as error:
            conflict(form,error)
    return page(request,'volunteer_profile/volunteer_profile.html','আমার প্রোফাইল / My profile',groups=form_groups(('বর্তমান ঠিকানা / Current address',address),('সক্ষমতা ও সেবার জেলা / Capabilities and service districts',form)),photo=profile.profile_photo)


@role_required(Role.VOLUNTEER)
def organizations(request):
    from django import forms
    form = forms.Form(request.POST or None)
    form.fields['organization'] = forms.ModelChoiceField(label='সংগঠন / Organization',queryset=Organization.objects.filter(verification_status='approved'))
    if request.method == 'POST' and form.is_valid():
        try:
            apply_membership(request.user,form.cleaned_data['organization'].pk)
            saved(request)
            return redirect('volunteer_organization')
        except ValidationError as error:
            conflict(form,error)
    organizations = Organization.objects.filter(verification_status='approved')
    if request.GET.get('search'):
        organizations = organizations.filter(name__icontains=request.GET['search'])
    return page(request,'volunteer_organizations/volunteer_organizations.html','সংগঠনে যোগ দিন / Join an organization',form=form,organizations=organizations)


@role_required(Role.VOLUNTEER)
def organization(request):
    from Sara.forms import ReasonForm
    form = ReasonForm(request.POST or None)
    form.fields['reason'].required=False
    if request.method == 'POST' and form.is_valid():
        try:
            end_membership(request.user,withdraw=request.POST.get('action')=='withdraw')
            saved(request)
            return redirect('volunteer_organization')
        except ValidationError as error:
            conflict(form,error)
    profile = VolunteerProfile.objects.select_related(
        'organization__office_location', 'organization__administrator',
    ).prefetch_related('organization__operating_districts').get(user=request.user)
    org = profile.organization
    return page(request,'volunteer_organization/volunteer_organization.html','আমার সংগঠন / My organization',
                profile=profile,form=form,
                organization_member_count=org.membership_profiles.filter(membership_status='approved').count() if org else 0,
                organization_team_count=org.teams.count() if org else 0)


@role_required(Role.VOLUNTEER)
def team(request):
    from Sara.forms import ReasonForm
    form = ReasonForm(request.POST or None)
    form.fields['reason'].required=False
    if request.method == 'POST' and form.is_valid():
        try:
            leave_team(request.user)
            saved(request)
            return redirect('volunteer_team')
        except ValidationError as error:
            conflict(form,error)
    team = request.user.volunteer_profile.active_team
    return page(request,'volunteer_team/volunteer_team.html','আমার দল / My team',team=team,form=form,roster=team.memberships.filter(is_active=True).select_related('volunteer__user') if team else [])
