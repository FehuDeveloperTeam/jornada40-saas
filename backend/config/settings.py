"""
Django settings for config project.
"""

from pathlib import Path
import dj_database_url
from decouple import config
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-test-key')

# Detectar si estamos en Railway (Producción)
IS_PRODUCTION = config('RAILWAY_ENVIRONMENT_NAME', default=None) is not None

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = not IS_PRODUCTION

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
    'rest_framework',
    'rest_framework.authtoken',
    'dj_rest_auth',
    'corsheaders', 
    
    # Local
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', 
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
}

SITE_ID = 1


REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'jornada40-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'jornada40-refresh-token',
    'JWT_AUTH_SECURE': IS_PRODUCTION,      
    'JWT_AUTH_SAMESITE': 'None' if IS_PRODUCTION else 'Lax',
}

# ==================================
#  CONFIGURACIÓN DE RED Y SEGURIDAD
# ==================================

if IS_PRODUCTION:
    
    # 1. ALLOWED HOSTS
    ALLOWED_HOSTS = ["jornada40-saas-production.up.railway.app"]

    # 2. CORS: 
    CORS_ALLOWED_ORIGINS = [
        "https://jornada40-saas.vercel.app", 
    ]           
    CORS_ALLOW_CREDENTIALS = True
    
    # 3. CSRF
    CSRF_TRUSTED_ORIGINS = [
        "https://jornada40-saas.vercel.app",             
        "https://jornada40-saas-production.up.railway.app", 
    ]

    # 4. Cookies Seguras para dominios cruzados
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

    # Cookies para http://
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
        'level': 'DEBUG',
    },
}

# ==========================================
# CONFIGURACIÓN DE ENVÍO DE CORREOS (SMTP)
# ==========================================
EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
ANYMAIL = {
    "RESEND_API_KEY": config('RESEND_API_KEY', default='re_eeCE1qpe_BdMdV2pnUidZMHrN9crr6ch5'),
}

DEFAULT_FROM_EMAIL = 'onboarding@resend.dev'
# Esta es la URL de tu frontend a la que el usuario será redirigido al hacer clic en el correo
# dj_rest_auth usará esto para armar el link: https://tu-frontend.com
# Esta es la URL de tu frontend a la que el usuario será redirigido al hacer clic en el correo
# dj_rest_auth usará esto para armar el link: https://tu-frontend.com/reset-password/<uid>/<token>/
PASSWORD_RESET_CONFIRM_URL = 'https://jornada40-saas.vercel.app/reset-password/{uid}/{token}'