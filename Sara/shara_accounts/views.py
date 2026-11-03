from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm, SetPasswordForm
from django.contrib.auth.views import LoginView
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from Sara.domain import Role
from Sara.web import page, saved, conflict
from .models import User
from .forms import LoginForm, AccountForm, RecoveryIssueForm
from .models import role_required
from .models import issue_recovery, recovery_tokens


class AccountLoginView(LoginView):
    template_name = 'login/login.html'
    authentication_form = LoginForm
    redirect_authenticated_user = True
    extra_context = {'title':'লগইন / Login'}
    def get_success_url(self):
        return self.get_redirect_url() or reverse({'volunteer':'volunteer_dashboard','organization_admin':'org_dashboard','super_admin':'admin_dashboard'}[self.request.user.role])


@login_required
def account_settings(request):
    account = AccountForm(request.POST if request.method == 'POST' and request.POST.get('action') == 'account' else None, instance=request.user)
    password = PasswordChangeForm(request.user, request.POST if request.method == 'POST' and request.POST.get('action') == 'password' else None)
    if request.method == 'POST':
        form = account if request.POST.get('action') == 'account' else password
        if form.is_valid():
            try:
                with transaction.atomic():
                    form.save()
                    if form is password:
                        request.user.must_change_password = False
                        request.user.save()
                        update_session_auth_hash(request, request.user)
                saved(request)
                return redirect('account_settings')
            except (ValidationError, IntegrityError) as error:
                conflict(form, error)
    return page(request, 'account_settings/account_settings.html','অ্যাকাউন্ট / Account', account_form=account, password_form=password)


def recovery(request):
    return page(request, 'account_recovery/account_recovery.html','অ্যাকাউন্ট পুনরুদ্ধার / Account recovery', support_contact=settings.SHARA_SUPPORT_CONTACT)


@role_required(Role.SUPER_ADMIN)
def admin_recovery(request):
    form = RecoveryIssueForm(request.POST or None)
    credential = None
    if request.method == 'POST' and form.is_valid():
        try:
            user, token = issue_recovery(request.user, form.cleaned_data['identifier'])
            credential = request.build_absolute_uri(reverse('account_reset')) + '?uid=' + urlsafe_base64_encode(force_bytes(user.pk)) + '&token=' + token
        except ValidationError as error:
            conflict(form, error)
    response = page(request,'admin_account_recovery/admin_account_recovery.html','যাচাইকৃত পুনরুদ্ধার / Verified account recovery', form=form, credential=credential)
    response['Cache-Control'] = 'no-store'
    response['Referrer-Policy'] = 'no-referrer'
    return response


def reset(request):
    if request.method == 'GET' and 'token' in request.GET:
        request.session['reset_credential'] = {'uid':request.GET.get('uid',''), 'token':request.GET['token']}
        return redirect('account_reset')
    data = request.session.get('reset_credential', {})
    try:
        user = User.objects.get(pk=urlsafe_base64_decode(data.get('uid','')).decode())
    except (User.DoesNotExist, ValueError, UnicodeDecodeError, ValidationError):
        user = None
    valid = user is not None and user.is_active and recovery_tokens.check_token(user, data.get('token',''))
    form = SetPasswordForm(user, request.POST or None) if valid else None
    if request.method == 'POST' and valid and form.is_valid():
        with transaction.atomic():
            locked = User.objects.select_for_update().get(pk=user.pk)
            if recovery_tokens.check_token(locked, data['token']):
                locked.set_password(form.cleaned_data['new_password1'])
                locked.must_change_password = False
                locked.save()
                request.session.pop('reset_credential', None)
                saved(request)
                return redirect('login')
            valid, form = False, None
    response = page(request,'account_reset/account_reset.html','নতুন পাসওয়ার্ড / Set password',form=form, invalid_credential=not valid)
    response['Cache-Control'] = 'no-store'
    response['Referrer-Policy'] = 'no-referrer'
    return response
