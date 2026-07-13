"""
URL configuration for Users app.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import DyuksaTokenObtainPairSerializer
from .views import (
    ChangeUserRoleView, ForgotPasswordView, VerifyOTPView, SetNewPasswordView,
    AuthenticatedResetPasswordView, SendInvitationView, VerifyInvitationTokenView,
    AcceptInvitationView, ContactUsView, WorkspaceSafeTokenRefreshView, SocialAuthView,
)
from . import views


# ---------------------------------------------------------------------------
# Custom login view — uses DyuksaTokenObtainPairSerializer so every JWT
# issued by this endpoint carries org_id, role, platforms, etc.
# The URL (/login/), request shape, and response shape are unchanged.
# ---------------------------------------------------------------------------

class DyuksaTokenObtainPairView(TokenObtainPairView):
    serializer_class = DyuksaTokenObtainPairSerializer


urlpatterns = [
    path("create-user/",           views.UserCreateView.as_view(),              name="create-user"),
    path("login/",                 DyuksaTokenObtainPairView.as_view(),         name="login"),          # ← custom serializer
    path("refresh/",               WorkspaceSafeTokenRefreshView.as_view(),     name="token_refresh"),
    path("me/",                    views.MeView.as_view(),                       name="me"),
    path("users/",                 views.UserListView.as_view(),                 name="user-list"),
    path("update-role/<int:user_id>/", ChangeUserRoleView.as_view(),            name="update-user-role"),
    path("forgot-password/",       ForgotPasswordView.as_view(),                name="forgot-password"),
    path("verify-otp/",            VerifyOTPView.as_view(),                     name="verify-otp"),
    path("set-new-password/",      SetNewPasswordView.as_view(),                name="set-new-password"),
    path("reset-password/",        AuthenticatedResetPasswordView.as_view(),    name="reset-password"),
    path("delete-user/<int:id>/",  views.UserDeleteView.as_view(),              name="delete-user"),
    path("invite/send/",           SendInvitationView.as_view(),                name="send-invite"),
    path("invite/verify/<str:token>/", VerifyInvitationTokenView.as_view(),     name="verify-invite"),
    path("invite/accept/",         AcceptInvitationView.as_view(),              name="accept-invite"),
    path("contact/",               ContactUsView.as_view(),                     name="contact-us"),
    path("social-auth/",           SocialAuthView.as_view(),                    name="social-auth"),
    path("token/verify/",          TokenVerifyView.as_view(),                   name="token-verify"),   # ← new: HRMS/CRM can verify tokens
]