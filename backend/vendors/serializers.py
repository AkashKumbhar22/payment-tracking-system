from rest_framework import serializers
from .models import Vendor

class VendorSerializer(serializers.ModelSerializer):
    bank_account_details = serializers.SerializerMethodField()
    bank_account_raw = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Vendor
        fields = ('id', 'name', 'email', 'bank_account_details', 'bank_account_raw', 'created_at')

    def get_bank_account_details(self, obj) -> str:
        request = self.context.get('request')
        # Only FINANCE_ADMIN can see full bank details. Others see masked.
        if request and request.user and request.user.is_authenticated:
            if request.user.role == 'FINANCE_ADMIN':
                return obj.bank_account_details
        
        full_details = obj.bank_account_details
        if len(full_details) > 4:
            return '*' * (len(full_details) - 4) + full_details[-4:]
        return '****'

    def create(self, validated_data):
        bank_account_raw = validated_data.pop('bank_account_raw', '')
        vendor = Vendor(**validated_data)
        vendor.bank_account_details = bank_account_raw
        vendor.save()
        return vendor

    def update(self, instance, validated_data):
        bank_account_raw = validated_data.pop('bank_account_raw', None)
        if bank_account_raw is not None:
            instance.bank_account_details = bank_account_raw
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
