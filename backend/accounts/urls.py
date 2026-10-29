from django.urls import path

from .views import CurrentUserView, LoginView, LogoutView, PasswordChangeView, RegisterView, csrf_cookie

urlpatterns = [
    path("csrf/", csrf_cookie, name="api-csrf"),
    path("register/", RegisterView.as_view(), name="api-register"),
    path("login/", LoginView.as_view(), name="api-login"),
    path("logout/", LogoutView.as_view(), name="api-logout"),
    path("me/", CurrentUserView.as_view(), name="api-current-user"),
    path("password/", PasswordChangeView.as_view(), name="api-password-change"),
]
