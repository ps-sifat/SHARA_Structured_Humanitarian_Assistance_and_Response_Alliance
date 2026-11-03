from django.core.exceptions import ValidationError
from django.db import IntegrityError,transaction
from django.shortcuts import redirect,get_object_or_404
from Sara.domain import Role
from Sara.web import page,form_groups,saved,conflict
from shara_accounts.models import role_required,own_organization
from geo_locations.forms import save_districts
from .forms import TeamForm
from .models import VolunteerTeam
from .models import save_team


@role_required(Role.ORGANIZATION_ADMIN,Role.SUPER_ADMIN,approved=True)
def index(request):
    teams = VolunteerTeam.objects.select_related('organization','leader__user').all()
    admin = request.user.role == Role.SUPER_ADMIN
    if not admin:
        teams=teams.filter(organization=own_organization(request.user))
    if request.GET.get('availability'):
        teams=teams.filter(availability=request.GET['availability'])
    if request.GET.get('search'):
        teams=teams.filter(name__icontains=request.GET['search'])
    if request.GET.get('workload')=='busy':
        teams=teams.filter(missions__status__in=['assigned','accepted','in_progress','paused']).distinct()
    return page(request,'admin_teams/admin_teams.html' if admin else 'org_teams/org_teams.html','দল / Teams',teams=teams,can_edit=not admin)


@role_required(Role.ORGANIZATION_ADMIN,approved=True)
def edit(request,id=None):
    organization = own_organization(request.user)
    team = get_object_or_404(organization.teams,pk=id) if id else None
    initial = {'availability':'ready'}
    if team:
        initial.update(name=team.name,assistance_capabilities=team.assistance_capabilities,availability=team.availability,leader=team.leader_id,members=list(team.memberships.filter(is_active=True).values_list('volunteer_id',flat=True)),districts=list(team.operating_districts.values_list('district_code',flat=True)))
    form = TeamForm(request.POST or None,organization=organization,team=team,initial=initial)
    if request.method == 'POST' and form.is_valid():
        try:
            with transaction.atomic():
                data=form.cleaned_data
                save_team(request.user,team_id=team.pk if team else None,name=data['name'],districts=save_districts(data['districts']),capabilities=data['assistance_capabilities'],members=data['members'],leader=data['leader'],availability=data['availability'])
            saved(request)
            return redirect('org_teams')
        except (ValidationError,IntegrityError) as error:
            conflict(form,error)
    return page(request,'org_team_edit/org_team_edit.html' if team else 'org_team_new/org_team_new.html','দল সম্পাদনা / Edit team' if team else 'নতুন দল / New team',groups=form_groups(('দল ও সদস্য / Team and members',form)),team=team)
