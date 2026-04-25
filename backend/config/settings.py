"""
Django settings for config project.
"""

from pathlib import Path
import dj_database_url
from decouple import config
import os
import re

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Detectar entorno Railway
RAILWAY_ENV = config('RAILWAY_ENVIRONMENT_NAME', default=None)
IS_PRODUCTION = RAILWAY_ENV == 'production'
IS_STAGING = RAILWAY_ENV is not None and not IS_PRODUCTION
IS_DEPLOYED = RAILWAY_ENV is not None  # cualquier entorno Railway

# SECRET_KEY es obligatorio en producción. En desarrollo local se permite fallback.
if IS_DEPLOYED:
    SECRET_KEY = config('SECRET_KEY')
else:
    SECRET_KEY = config('SECRET_KEY', default='django-insecure-local-dev-only-never-use-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = not IS_DEPLOYED

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',  
    'django.contrib.humanize',
    
    # Third party
    'storages',
    'rest_framework',
    'rest_framework.authtoken',
    'dj_rest_auth',
    'corsheaders', 
    
    # Local
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default='sqlite:///db.sqlite3'),
        conn_max_age=600,
    )
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    { 'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator', },
]

# Internationalization
LANGUAGE_CODE = 'es-cl' # Cambio a español de Chile para que las fechas calcen mejor con el sistema
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =========================================================
#   CONFIGURACIÓN REST FRAMEWORK & AUTH
# =========================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day',
        'login': '10/minute',
        'register': '5/minute',
        'password_reset': '5/hour',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 200,
}

SITE_ID = 1


REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'jornada40-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'jornada40-refresh-token',
    'JWT_AUTH_SECURE': IS_DEPLOYED,
    # SameSite=None + Secure es obligatorio para envío cross-site (Vercel → Railway).
    'JWT_AUTH_SAMESITE': 'None' if IS_DEPLOYED else 'Lax',
    'PASSWORD_RESET_SERIALIZER': 'core.serializers.CustomPasswordResetSerializer',
}

# ==================================
#  CONFIGURACIÓN DE RED Y SEGURIDAD
# ==================================

# Headers de seguridad HTTP (aplican en todos los entornos desplegados)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

if IS_PRODUCTION:

    ALLOWED_HOSTS = [
        "jornada40-saas-production.up.railway.app",
        "api.jornada40.cl",
        "jornada40.cl",
        "www.jornada40.cl",
    ]
    CORS_ALLOWED_ORIGINS = [
        "https://jornada40.cl",
        "https://www.jornada40.cl",
        "https://jornada40-saas.vercel.app",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CSRF_TRUSTED_ORIGINS = [
        "https://jornada40.cl",
        "https://www.jornada40.cl",
        "https://jornada40-saas.vercel.app",
        "https://api.jornada40.cl",
        "https://jornada40-saas-production.up.railway.app",
    ]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

elif IS_STAGING:

    ALLOWED_HOSTS = [
        config('RAILWAY_PUBLIC_DOMAIN', default=''),
        '.railway.app',
    ]
    # Solo acepta previews del proyecto propio en Vercel (no cualquier *.vercel.app)
    _vercel_project = config('VERCEL_PROJECT_NAME', default='jornada40-saas')
    CORS_ALLOWED_ORIGIN_REGEXES = [
        rf'^https://{re.escape(_vercel_project)}(-[a-z0-9]+)*\.vercel\.app$',
    ]
    CORS_ALLOWED_ORIGINS = []
    CORS_ALLOW_CREDENTIALS = True
    CSRF_TRUSTED_ORIGINS = [
        f'https://{_vercel_project}*.vercel.app',
        f"https://{config('RAILWAY_PUBLIC_DOMAIN', default='')}",
    ]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'

else:
    # === DESARROLLO (LOCALHOST) ===
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
    CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS = True
    CSRF_TRUSTED_ORIGINS = ["http://localhost:5173"]
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
# ==========================================
# CONFIGURACIÓN DE SESIONES Y JWT (30 MINUTOS)
# ==========================================

# 1. Duración de la sesión: 30 minutos (1800 segundos)
SESSION_COOKIE_AGE = 1800 

# 2. Renovar la sesión automáticamente si el usuario sigue activo
SESSION_SAVE_EVERY_REQUEST = True

# 3. Cerrar la sesión inmediatamente si el usuario cierra el navegador
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=2),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING' if IS_DEPLOYED else 'DEBUG',
    },
}

# ==========================================
# CONFIGURACIÓN DE ENVÍO DE CORREOS (SMTP)
# ==========================================
EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
ANYMAIL = {
    "RESEND_API_KEY": config('RESEND_API_KEY', default=''),
}

DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Jornada40 <noreply@jornada40.cl>')
# Esta es la URL de tu frontend a la que el usuario será redirigido al hacer clic en el correo
# dj_rest_auth usará esto para armar el link: https://tu-frontend.com
# Esta es la URL de tu frontend a la que el usuario será redirigido al hacer clic en el correo
# dj_rest_auth usará esto para armar el link: https://tu-frontend.com/reset-password/<uid>/<token>/
PASSWORD_RESET_CONFIRM_URL = 'https://jornada40.cl/reset-password/{uid}/{token}'
# ==========================================
# ALMACENAMIENTO DE ARCHIVOS (PDFs, contratos)
# ==========================================
B2_KEY_ID          = config('B2_KEY_ID',          default=None)
B2_APPLICATION_KEY = config('B2_APPLICATION_KEY', default=None)
B2_BUCKET_NAME     = config('B2_BUCKET_NAME',     default=None)
B2_ENDPOINT_URL    = config('B2_ENDPOINT_URL',    default=None)

if IS_DEPLOYED and B2_KEY_ID:
    # Backblaze B2 — S3-compatible object storage (activo cuando las vars están configuradas)
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "access_key":         B2_KEY_ID,  # leído de variable de entorno
                "secret_key":         B2_APPLICATION_KEY,
                "bucket_name":        B2_BUCKET_NAME,
                "endpoint_url":       B2_ENDPOINT_URL,
                "default_acl":        "private",
                "querystring_auth":   True,
                "querystring_expire": 3600,
                "file_overwrite":     False,
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_URL = config('B2_PUBLIC_URL', default='')
else:
    # Filesystem local (dev) o Railway sin B2 aún configurado
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')