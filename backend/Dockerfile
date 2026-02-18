# 1. Usar una imagen oficial de Python ligera
FROM python:3.11-slim

# 2. Configurar variables de entorno para que Python no genere archivos basura
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 3. Crear carpeta de trabajo dentro del contenedor
WORKDIR /app

# 4. Instalar dependencias del sistema necesarias para PostgreSQL (psycopg2)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 5. Copiar el archivo de requerimientos
COPY requirements.txt /app/

# 6. Actualizar pip e instalar librerías
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copiar todo el código del proyecto a la carpeta de trabajo
COPY . /app/

# 8. Recolectar archivos estáticos (CSS/JS) para que se vea bonito el Admin
# El "|| true" evita que falle si hay algún error menor en estáticos
RUN python manage.py collectstatic --noinput || true

# 9. Comando para iniciar el servidor usando Gunicorn
CMD gunicorn config.wsgi:application --bind 0.0.0.0:$PORT