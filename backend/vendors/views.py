from rest_framework import viewsets, permissions
from .models import Vendor
from .serializers import VendorSerializer

class VendorViewSet(viewsets.ModelModelViewSet if hasattr(viewsets, 'ModelModelViewSet') else viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('-created_at')
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated]
