# 1. Usar Python
FROM python:3.11-slim

# 2. Configuración
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Directorio de trabajo
WORKDIR /app

# 4. Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libcairo2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Si el contexto es 'root', copiamos 'backend/requirements.txt'
COPY requirements.txt /app/ 

# 6. Instalar librerías
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copiar el código
COPY . /app/

# 8. Estáticos y Ejecución
RUN python manage.py collectstatic --noinput || true

CMD python manage.py migrate && \
    python manage.py createsuperuser --noinput || true && \
    gunicorn config.wsgi:application --bind 0.0.0.0:$PORT