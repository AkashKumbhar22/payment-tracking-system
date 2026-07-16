from rest_framework import serializers
from django.contrib.auth import get_user_model
from vendors.models import Vendor
from vendors.serializers import VendorSerializer
from authentication.serializers import UserSerializer
from .models import Invoice, ApprovalStep

User = get_user_model()

class ApprovalStepSerializer(serializers.ModelSerializer):
    approver = UserSerializer(read_only=True)

    class Meta:
        model = ApprovalStep
        fields = ('id', 'approver', 'status', 'stage', 'comments', 'updated_at')


class InvoiceSerializer(serializers.ModelSerializer):
    vendor = VendorSerializer(read_only=True)
    submitted_by = UserSerializer(read_only=True)
    approval_steps = ApprovalStepSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = (
            'id', 
            'invoice_number', 
            'vendor', 
            'amount', 
            'tax_amount', 
            'due_date', 
            'status', 
            'submitted_by', 
            'file_url', 
            'approval_steps',
            'created_at'
        )


class InvoiceCreateSerializer(serializers.ModelSerializer):
    vendor_id = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all(), source='vendor')
    assigned_approver_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.APPROVER), 
        write_only=True
    )
    secondary_approver_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.APPROVER), 
        write_only=True, 
        required=False
    )

    class Meta:
        model = Invoice
        fields = (
            'id',
            'invoice_number', 
            'vendor_id', 
            'amount', 
            'tax_amount', 
            'due_date', 
            'file_url', 
            'assigned_approver_id', 
            'secondary_approver_id'
        )

    def validate(self, attrs):
        amount = attrs.get('amount')
        assigned_approver = attrs.get('assigned_approver_id')
        secondary_approver = attrs.get('secondary_approver_id')

        if amount and amount > 10000:
            if not secondary_approver:
                raise serializers.ValidationError({
                    "secondary_approver_id": "Invoices exceeding $10,000 require a two-stage approval workflow and a secondary approver must be selected."
                })
            if assigned_approver == secondary_approver:
                raise serializers.ValidationError({
                    "secondary_approver_id": "The secondary approver must be different from the primary approver."
                })
        return attrs

    def create(self, validated_data):
        assigned_approver = validated_data.pop('assigned_approver_id')
        secondary_approver = validated_data.pop('secondary_approver_id', None)
        
        request = self.context.get('request')
        validated_data['submitted_by'] = request.user
        validated_data['status'] = Invoice.Status.PENDING_APPROVAL
        
        invoice = Invoice.objects.create(**validated_data)
        
        # Create stage 1 approval step
        ApprovalStep.objects.create(
            invoice=invoice,
            approver=assigned_approver,
            stage=1,
            status=ApprovalStep.Status.PENDING
        )
        
        # Create stage 2 approval step if invoice exceeds $10,000
        if invoice.amount > 10000 and secondary_approver:
            ApprovalStep.objects.create(
                invoice=invoice,
                approver=secondary_approver,
                stage=2,
                status=ApprovalStep.Status.PENDING
            )
            
        return invoice
