from django.contrib import admin
from django.urls import path, include
from core.views import ThrottledLoginView, ThrottledPasswordResetView


urlpatterns = [
    path('admin/', admin.site.urls),

    # Login y password reset con rate limiting propio (antes de dj_rest_auth.urls)
    path('api/auth/login/', ThrottledLoginView.as_view(), name='rest_login'),
    path('api/auth/password/reset/', ThrottledPasswordResetView.as_view(), name='rest_password_reset'),

    # API Auth (Logout — login y reset ya están arriba)
    path('api/auth/', include('dj_rest_auth.urls')),

    # Endpoints de la App
    path('api/', include('core.urls')),
]