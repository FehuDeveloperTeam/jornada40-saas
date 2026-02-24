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
    'django.contrib.sites',  # <-- Necesario para dj-rest-auth
    
    # Third party
    'rest_framework',
    'rest_framework.authtoken',
    'dj_rest_auth',
    'corsheaders', # Vital para conectar con Vercel
    
    # Local
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # <--- DEBE ESTAR AQUÍ (Arriba de Common)
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
LANGUAGE_CODE = 'es-cl' # Lo cambié a español de Chile para que las fechas calcen mejor con tu SaaS
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

# NUEVA SINTAXIS PARA dj-rest-auth 7.x
REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'jornada40-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'jornada40-refresh-token',
    'JWT_AUTH_SECURE': IS_PRODUCTION,      # True en Railway, False en Local
    'JWT_AUTH_SAMESITE': 'None' if IS_PRODUCTION else 'Lax',
}

# =========================================================
#   CONFIGURACIÓN DE RED Y SEGURIDAD (LA SOLUCIÓN DEL 401)
# =========================================================

if IS_PRODUCTION:
    # === PRODUCCIÓN (RAILWAY) ===
    
    # 1. ALLOWED HOSTS
    ALLOWED_HOSTS = ["*"]

    # 2. CORS: Lista VIP estricta (¡Adiós ALLOW_ALL_ORIGINS!)
    CORS_ALLOWED_ORIGINS = [
        "https://jornada40-saas.vercel.app",             # Tu Frontend en Vercel
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

    # Cookies relajadas para http://
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False