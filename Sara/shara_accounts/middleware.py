from django.shortcuts import redirect


class RequirePasswordChangeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.user.must_change_password and request.path not in ['/account/settings/','/logout/','/account/reset/'] and not request.path.startswith('/static/'):
            return redirect('account_settings')
        return self.get_response(request)
