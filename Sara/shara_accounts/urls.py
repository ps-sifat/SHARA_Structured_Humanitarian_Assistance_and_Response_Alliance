from django.urls import path
from django.contrib.auth.views import LogoutView
from . import views
urlpatterns = [
    path('login/', views.AccountLoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('account/settings/', views.account_settings, name='account_settings'),
    path('account/recovery/', views.recovery, name='account_recovery'),
    path('account/reset/', views.reset, name='account_reset'),
    path('admin/account-recovery/', views.admin_recovery, name='admin_account_recovery'),
]
