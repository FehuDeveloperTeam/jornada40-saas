"""Settings para las pruebas de navegador (frontend/e2e). Solo se usan explícitamente:
DJANGO_SETTINGS_MODULE=config.settings_e2e. Producción usa config.settings."""
import os

from config.settings import *  # noqa: F401,F403
from config.settings import BASE_DIR, INSTALLED_APPS, REST_FRAMEWORK

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3',
                         'NAME': os.environ.get('E2E_DB', str(BASE_DIR / 'e2e.sqlite3'))}}
E2E_ARCHIVOS_DIR = os.environ.get('E2E_ARCHIVOS_DIR', str(BASE_DIR / 'e2e-archivos'))
MEDIA_ROOT = os.path.join(E2E_ARCHIVOS_DIR, 'media')
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# Las pruebas inician sesión muchas veces seguidas desde la misma IP.
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {
    **REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],
    'login': '1000/minute', 'register': '1000/minute', 'password_reset': '1000/hour',
    'anon': '100000/day', 'user': '100000/day',
    'firma_publica': '100000/hour', 'firma_publica_ip': '100000/day'}}
INSTALLED_APPS = [*INSTALLED_APPS, 'e2e']
