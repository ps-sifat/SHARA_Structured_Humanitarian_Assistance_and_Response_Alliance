from rest_framework.permissions import BasePermission


class PublicHelpRequestSubmission(BasePermission):
    """Allow an account-free submission view to accept POST requests only."""

    def has_permission(self, request, view):
        return request.method == "POST"
