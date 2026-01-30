"""
Django settings for backend project.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Carga las variables de entorno desde un archivo .env
load_dotenv()


# Quick-start development settings - unsuitable for production
SECRET_KEY = os.environ.get(
    'SECRET_KEY', 'django-insecure-default-key-for-dev')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')

ALLOWED_HOSTS = os.environ.get(
    'ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')


# Application definition

INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'api',
    'chat',
    
    # Apps de terceros para la API y autenticación
    'rest_framework',
    'rest_framework.authtoken',
    
    # 💥 ELIMINADO: 'dj_rest_auth', 'dj_rest_auth.registration'
    
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    
    # 💥 NUEVO: djoser para manejar la autenticación
    'djoser', 
    
    'django_filters',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'backend.urls'

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

ASGI_APPLICATION = 'backend.asgi.application'

# Database
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL is required')

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600
    )
}

# Password validation... (Sin cambios)
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization... (Sin cambios)
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage' 
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Configuraciones para REST Framework y Autenticación ---
SITE_ID = 1

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

# --- CONFIGURACIÓN DE DJOSER (Limpia y Moderna) ---

# Reemplaza todo el bloque de configuración anterior de allauth/dj-rest-auth
DJOSER = {
    'USER_ID_FIELD': 'id', 
    'PASSWORD_RESET_CONFIRM_URL': '#/password/reset/confirm/{uid}/{token}',
    'USERNAME_RESET_CONFIRM_URL': '#/username/reset/confirm/{uid}/{token}',
    'ACTIVATION_URL': '#/activate/{uid}/{token}',
    'SEND_ACTIVATION_EMAIL': False, # Mejor dejar en False para desarrollo
    'SERIALIZERS': {
        'user_create': 'djoser.serializers.UserCreateSerializer',
        'user': 'djoser.serializers.UserSerializer',
    },
}

# Configuración de allauth (ahora usada por djoser)
ACCOUNT_LOGIN_METHODS = ['username', 'email']
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*', 'password2*'] 
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
ACCOUNT_EMAIL_CONFIRMATION_HMAC= False


# --- CORRECCIÓN DE CORS (Final) ---

if DEBUG:
    # En desarrollo local
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
else:
    # En producción (Render)
    RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL")

    # CRÍTICO: Limpiar la URL para eliminar cualquier protocolo duplicado
    import re
    if RENDER_EXTERNAL_URL:
        # 1. Limpiamos 'https://' o 'wss://' de la URL inyectada por Render
        # Obtenemos solo el hostname (ej: mi-backend-django.onrender.com)
        HOSTNAME = re.sub(r'^https?://|^wss?://', '', RENDER_EXTERNAL_URL)

        # 2. Construimos las URLs de CORS usando el hostname limpio
        CORS_ALLOWED_ORIGINS = [
            f"https://{HOSTNAME}",  # PROTOCOLO HTTPS (DRF/API)
            f"wss://{HOSTNAME}",    # PROTOCOLO WSS (WebSockets)
            # Asegúrate de incluir aquí el dominio HTTPS de tu Frontend de Render si es un Static Site separado
        ]
    else:
        # Fallback si RENDER_EXTERNAL_URL no está definido (aunque no debería ocurrir en Render)
        CORS_ALLOWED_ORIGINS = []

CORS_ALLOW_CREDENTIALS = True


# --- Configuración de CHANNELS / WEBSOCKETS ---
REDIS_URL = os.environ.get("REDIS_URL")

if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.pubsub.RedisPubSubChannelLayer',
            'CONFIG': {
                "hosts": [REDIS_URL],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }