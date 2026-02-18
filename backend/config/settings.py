"""
Django settings for config project.
"""

from pathlib import Path
import dj_database_url
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-test-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# 1. IMPORTANTE: Permitir localhost explícitamente
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'jornada40-saas-production.up.railway.app']  # Agrega tu dominio de Vercel aquí


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
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
    'corsheaders.middleware.CorsMiddleware', # OJO: Debe estar aquí, antes de CommonMiddleware
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
        'DIRS': [],
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
        ssl_require=not DEBUG  # True en prod, False en local
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
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# =========================================================
#   CONFIGURACIÓN SAAS JORNADA 40 (CORREGIDA Y DEFINITIVA)
# =========================================================

# 1. CORS: Permitir conexión desde el Frontend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://jornada40-saas.vercel.app",  # URL de Vercel (cuando la tengamos)
]
CORS_ALLOW_CREDENTIALS = True  # ¡Crucial! Permite pasar cookies

# 2. CSRF: Confianza en el origen
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "https://jornada40-saas.vercel.app",
]

# 3. REST FRAMEWORK & AUTH
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# Configuración de dj-rest-auth
SITE_ID = 1
REST_USE_JWT = True
JWT_AUTH_COOKIE = 'jornada40-auth'
JWT_AUTH_REFRESH_COOKIE = 'jornada40-refresh-token'

# =========================================================
#   ZONA DE COOKIES (MODO DESARROLLO / LOCALHOST)
#   Todo esto está relajado para que funcione sin HTTPS
# =========================================================

# --- CONFIGURACIÓN DINÁMICA (PRODUCCIÓN vs LOCAL) ---

# Railway inyecta esta variable automáticamente. Si existe, estamos en Prod.
RENDER_EXTERNAL_HOSTNAME = config('RAILWAY_ENVIRONMENT_NAME', default=None) 

if RENDER_EXTERNAL_HOSTNAME:
    # === ESTAMOS EN PRODUCCIÓN (Railway) ===
    DEBUG = False
    ALLOWED_HOSTS = ['jornada40-saas.vercel.app'] # O tu dominio de railway

    # CORS y CSRF (Aquí pondremos la URL de Vercel cuando la tengamos)
    # Por ahora permitimos todo para probar, luego lo cerramos
    CORS_ALLOW_ALL_ORIGINS = True 
    CSRF_TRUSTED_ORIGINS = ['https://*.vercel.app', 'https://*.railway.app']

    # Cookies Seguras (HTTPS)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    JWT_AUTH_SECURE = True

    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'
    JWT_AUTH_SAMESITE = 'None'

else:
    # === ESTAMOS EN LOCALHOST ===
    DEBUG = True
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']
    CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS = True

    # Cookies relajadas
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    JWT_AUTH_SECURE = False