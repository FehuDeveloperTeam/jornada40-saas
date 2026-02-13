from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Auth (Login/Logout/Password Reset)
    path('api/auth/', include('dj_rest_auth.urls')),

    # Endpoints de nuestra App
    path('api/', include('core.urls')),
]