from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import union_choices


@require_GET
def unions(request):
    # Only public reference data, never a query/serialization of address rows.
    choices = union_choices(request.GET.get('district',''),request.GET.get('upazila',''))
    return JsonResponse({'results':[{'code':code,'name':name} for code,name in choices.items()]})
