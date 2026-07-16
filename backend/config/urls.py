from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # App API endpoints
    path('api/', include('authentication.urls')),
    path('api/', include('vendors.urls')),
    path('api/', include('invoices.urls')),
]

