from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, UserProfileView, ApproverListView, UserRegisterView

urlpatterns = [
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair_custom'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh_custom'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),
    path('auth/approvers/', ApproverListView.as_view(), name='approvers_list'),
    path('auth/register/', UserRegisterView.as_view(), name='user_register'),
]
