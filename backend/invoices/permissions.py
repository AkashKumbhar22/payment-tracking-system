from rest_framework import permissions
from .models import Invoice

class IsSubmitter(permissions.BasePermission):
    """
    Allows access only to users with the SUBMITTER role.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'SUBMITTER'


class IsApprover(permissions.BasePermission):
    """
    Allows access only to users with the APPROVER role.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'APPROVER'


class IsFinanceAdmin(permissions.BasePermission):
    """
    Allows access only to users with the FINANCE_ADMIN role.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'FINANCE_ADMIN'


class IsInvoiceSubmitter(permissions.BasePermission):
    """
    Object-level permission to restrict editing/viewing to the submitter of the invoice.
    """
    def has_object_permission(self, request, obj, view):
        return obj.submitted_by == request.user
