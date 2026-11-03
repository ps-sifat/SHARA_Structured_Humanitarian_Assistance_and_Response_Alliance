"""Render persistent portal navigation in its final state before JavaScript runs."""
from django import template
from django.urls import reverse
from django.utils.html import format_html

register = template.Library()


def language_for(request):
    return 'en' if request.COOKIES.get('django_language') == 'en' else 'bn'


@register.simple_tag(takes_context=True)
def portal_language(context):
    return language_for(context['request'])


@register.simple_tag(takes_context=True)
def portal_label(context, bilingual):
    bn, separator, en = str(bilingual).partition(' / ')
    return en if separator and language_for(context['request']) == 'en' else bn


@register.simple_tag(takes_context=True)
def portal_link(context, route, bn, en):
    request = context['request']
    current = request.resolver_match.url_name or ''
    parents = {
        'admin_request_detail': 'admin_requests', 'org_request_detail': 'org_requests',
        'volunteer_request_detail': 'volunteer_requests',
        'admin_mission_detail': 'admin_missions', 'org_mission_detail': 'org_missions',
        'volunteer_mission_detail': 'volunteer_missions',
        'org_team_edit': 'org_teams', 'org_team_new': 'org_teams',
    }
    active = parents.get(current, current) == route
    return format_html(
        '<a class="ui-menu-link" href="{}"{} data-bn="{}" data-en="{}">{}</a>',
        reverse(route), format_html(' aria-current="{}"', 'page') if active else '',
        bn, en, en if language_for(request) == 'en' else bn,
    )
