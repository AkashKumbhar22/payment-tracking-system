from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Invoice, ApprovalStep
from .serializers import InvoiceSerializer, InvoiceCreateSerializer, ApprovalStepSerializer
from .permissions import IsSubmitter, IsApprover, IsFinanceAdmin

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InvoiceCreateSerializer
        return InvoiceSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsSubmitter()]
        elif self.action in ['approve', 'reject']:
            return [IsApprover()]
        elif self.action == 'pay':
            return [IsFinanceAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = Invoice.objects.all().prefetch_related('approval_steps', 'approval_steps__approver').select_related('vendor', 'submitted_by')
        
        # Apply Query Parameter Filtering (status & vendor)
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        vendor_param = self.request.query_params.get('vendor')
        if vendor_param:
            queryset = queryset.filter(vendor_id=vendor_param)
            
        # Role-based visibility rules
        if user.role == 'SUBMITTER':
            # Submitter sees only their own submitted invoices
            return queryset.filter(submitted_by=user).order_by('-created_at')
        elif user.role == 'APPROVER':
            # Approver sees invoices where they are assigned as an approver
            # The UI needs to show a dedicated queue of invoices waiting for their approval action.
            # We can return all invoices involving them as an approver.
            return queryset.filter(approval_steps__approver=user).distinct().order_by('-created_at')
        elif user.role == 'FINANCE_ADMIN':
            # Finance Admin sees all invoices
            return queryset.order_by('-created_at')
        
        return queryset.none()

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        invoice = self.get_object_or_404_with_prefetch(pk)
        
        # Find the pending approval step for this user
        pending_step = invoice.approval_steps.filter(
            approver=request.user, 
            status=ApprovalStep.Status.PENDING
        ).first()

        if not pending_step:
            return Response(
                {"detail": "You do not have a pending approval step for this invoice."},
                status=status.HTTP_400_BAD_REQUEST
            )

        comments = request.data.get('comments', '')

        with transaction.atomic():
            # Update the step
            pending_step.status = ApprovalStep.Status.APPROVED
            pending_step.comments = comments
            pending_step.save()

            # Refresh and check if ALL steps are approved (query directly to bypass stale prefetch cache)
            all_steps = ApprovalStep.objects.filter(invoice=invoice)
            if all(step.status == ApprovalStep.Status.APPROVED for step in all_steps):
                invoice.status = Invoice.Status.APPROVED
                invoice.save()


        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        invoice = self.get_object_or_404_with_prefetch(pk)

        # Find the pending approval step for this user
        pending_step = invoice.approval_steps.filter(
            approver=request.user, 
            status=ApprovalStep.Status.PENDING
        ).first()

        if not pending_step:
            return Response(
                {"detail": "You do not have a pending approval step for this invoice."},
                status=status.HTTP_400_BAD_REQUEST
            )

        comments = request.data.get('comments', '')

        with transaction.atomic():
            # Update the step
            pending_step.status = ApprovalStep.Status.REJECTED
            pending_step.comments = comments
            pending_step.save()

            # If any step is rejected, the entire invoice is rejected
            invoice.status = Invoice.Status.REJECTED
            invoice.save()

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='pay')
    def pay(self, request, pk=None):
        invoice = self.get_object_or_404_with_prefetch(pk)

        # Invoice must be approved to be paid
        if invoice.status != Invoice.Status.APPROVED:
            return Response(
                {"detail": f"Only APPROVED invoices can be paid. Current status: {invoice.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            invoice.status = Invoice.Status.PAID
            invoice.save()

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_200_OK)

    def get_object_or_404_with_prefetch(self, pk):
        # Helper to avoid stale prefetch cache during state checks
        return get_object_or_404(
            Invoice.objects.prefetch_related('approval_steps').select_related('vendor', 'submitted_by'),
            pk=pk
        )
