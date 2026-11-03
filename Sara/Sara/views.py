from django.shortcuts import render
from django.views.decorators.http import require_safe
from Sara.domain import Role, ACTIVE_MISSIONS
from Sara.web import page
from shara_accounts.models import role_required
from requests.models import HelpRequest
from missions.models import Mission
from organizations.models import Organization


@role_required(Role.SUPER_ADMIN)
def dashboard(request):
    return page(request,'admin_dashboard/admin_dashboard.html','প্রশাসন / Administration',request_count=HelpRequest.objects.filter(status='pending').count(),organization_count=Organization.objects.filter(verification_status='pending').count(),mission_count=Mission.objects.filter(status__in=ACTIVE_MISSIONS).count())


@require_safe
def privacy(request):
    return page(request,'privacy/privacy.html','গোপনীয়তা / Privacy')


def denied(request, exception=None):
    return render(request,'access_denied/access_denied.html',{'title':'প্রবেশাধিকার নেই / Access denied'},status=403)


def not_found(request, exception=None):
    return render(request,'errors/404.html',{'title':'পাওয়া যায়নি / Not found'},status=404)


def server_error(request):
    return render(request,'errors/500.html',{'title':'সার্ভারের সমস্যা / Server error'},status=500)
