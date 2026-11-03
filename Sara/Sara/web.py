"""Presentation helpers shared by the existing Django apps."""
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.shortcuts import render
from django.http import Http404
from uuid import UUID
from geo_locations.models import catalogue


def page(request, template, title, **context):
    return render(request, template, {'title':title, 'geography':catalogue(), **context})


def form_groups(*pairs):
    return [{'title': title, 'form':form} for title, form in pairs if form is not None]


def saved(request):
    messages.success(request, 'সংরক্ষিত হয়েছে। / Saved successfully.')


def record_id(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise Http404


def conflict(form, error):
    if isinstance(error, ValidationError):
        for message in error.messages:
            form.add_error(None, message)
    else:
        form.add_error(None, 'তথ্য ইতোমধ্যে বদলেছে বা ব্যবহৃত হয়েছে। আবার চেষ্টা করুন। / The record changed or is already in use. Refresh and try again.')


def request_summary(item, detail_url=None):
    return {'id':item.pk, 'reference':item.reference, 'area':str(item.location),
            'needs':item.need_categories, 'person_count':item.person_count,
            'priority':item.get_priority_display(), 'status':item.get_status_display(),
            'created_at':item.created_at, 'detail_url':detail_url}


def mission_summary(item, detail_url):
    return {**request_summary(item.help_request), 'detail_url':detail_url,
            'attempt':item.attempt_number, 'target':item.target_label,
            'stage':item.get_status_display(), 'priority':item.get_priority_display()}
