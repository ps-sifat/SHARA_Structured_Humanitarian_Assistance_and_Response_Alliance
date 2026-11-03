from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.shortcuts import redirect,get_object_or_404
from django.urls import reverse
from Sara.domain import Role, ACTIVE_MISSIONS
from Sara.web import page,conflict,saved,mission_summary
from shara_accounts.models import role_required
from .models import visible_missions,private_mission_access,report_access,responsible_assignee,supervising_admin
from .models import transition_mission
from .forms import MissionActionForm


def prefix(user):
    return {'volunteer':'volunteer','organization_admin':'org','super_admin':'admin'}[user.role]


@role_required(Role.VOLUNTEER,Role.ORGANIZATION_ADMIN,Role.SUPER_ADMIN,approved=True)
def index(request):
    items=visible_missions(request.user).select_related('help_request__location','assigned_team','assigned_volunteer__user')
    if request.GET.get('state')=='active':
        items=items.filter(status__in=ACTIVE_MISSIONS)
    elif request.GET.get('state')=='history':
        items=items.exclude(status__in=ACTIVE_MISSIONS)
    if request.GET.get('target')=='team':
        items=items.filter(assigned_team__isnull=False)
    elif request.GET.get('target')=='individual':
        items=items.filter(assigned_volunteer__isnull=False)
    if request.GET.get('search'):
        items=items.filter(help_request__reference__icontains=request.GET['search'])
    p=prefix(request.user)
    return page(request,f'{p}_missions/{p}_missions.html','মিশন / Missions',records=[mission_summary(m,reverse(p+'_mission_detail',args=[m.pk])) for m in items],mission_filters=True)


@role_required(Role.VOLUNTEER,Role.ORGANIZATION_ADMIN,Role.SUPER_ADMIN,approved=True)
def detail(request,id):
    item=get_object_or_404(visible_missions(request.user).select_related('help_request__location','assigned_team__leader__user','assigned_volunteer__user','supervising_organization'),pk=id)
    form=MissionActionForm(request.POST or None)
    if request.method=='POST' and form.is_valid():
        try:
            transition_mission(request.user,item.pk,**form.cleaned_data)
            saved(request)
            return redirect(request.path)
        except (ValidationError,IntegrityError) as error:
            conflict(form,error)
    responsible=responsible_assignee(request.user,item)
    actions=[]
    if item.active:
        if responsible:
            following={'assigned':('accept','গ্রহণ / Accept'),'accepted':('start','শুরু / Start'),'in_progress':('complete','সব প্রয়োজন পূর্ণ / Complete all needs')}.get(item.status)
            if following:
                actions.append(following)
        if responsible or supervising_admin(request.user,item):
            actions.extend([('cancel','বাতিল / Cancel'),('fail','ব্যর্থ / Mark failed')])
    # Construct only permitted private/report projections; never serialize the
    # domain instance to ordinary members or historical snapshot viewers.
    private=None
    if private_mission_access(request.user,item) or request.user.role==Role.SUPER_ADMIN:
        h=item.help_request
        private={'phone':h.contact_phone,'address':h.location.get_full_address(),'name':h.victim_name,'note':h.emergency_condition,'reporter_name':h.reporter_name,'reporter_phone':h.reporter_phone}
    report=None
    if report_access(request.user,item):
        report={'delivered':item.delivered_assistance,'debrief':item.completion_debrief,'issues':item.issues_encountered,'reason':item.end_reason,'confirmed':item.all_needs_fulfilled}
    p=prefix(request.user)
    times=[('নির্ধারিত / Assigned',item.assigned_at),('গৃহীত / Accepted',item.accepted_at),('শুরু / Started',item.started_at),('বিরতি / Paused',item.paused_at),('শেষ / Ended',item.ended_at)]
    return page(request,f'{p}_mission_detail/{p}_mission_detail.html','মিশনের বিবরণ / Mission detail',summary=mission_summary(item,None),private=private,report=report,actions=actions,form=form,times=times,needs_leader=item.status=='paused',team_edit=reverse('org_team_edit',args=[item.assigned_team_id]) if item.assigned_team_id and request.user.role=='organization_admin' else None,roster=item.assigned_team.memberships.filter(is_active=True).select_related('volunteer__user') if item.active and item.assigned_team_id else [],historical_roster=item.final_roster_snapshot if not item.active else [])
