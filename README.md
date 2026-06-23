# Cómo Ejecutar con Docker

## Requisitos

- Docker Desktop instalado
- Docker Compose (incluido en Docker Desktop)

## Desarrollo Local

### Paso 1: Crear archivo `.env`

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_HOST=host.docker.internal
DATABASE_PORT=3306
DATABASE_NAME=mision_emprende2
DATABASE_USER=root
DATABASE_PASSWORD=1234
SECRET_KEY=tu-secret-key-aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Paso 2: Importar base de datos (si tienes dump SQL)

```bash
mysql -u root -p mision_emprende2 < "Dump20251203 (1).sql"
```

### Paso 3: Ejecutar

```bash
docker-compose up --build
```

### Paso 4: Acceder

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/api

## Producción

### Paso 1: Crear archivo `.env.prod`

```env
DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_NAME=mision_emprende_prod
DATABASE_USER=mision_user
DATABASE_PASSWORD=tu-password
MYSQL_ROOT_PASSWORD=root-password
SECRET_KEY=tu-secret-key-seguro
DEBUG=False
ALLOWED_HOSTS=tu-dominio.com,localhost
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
CORS_ALLOWED_ORIGINS=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
```

### Paso 2: Importar base de datos (opcional)

```bash
docker-compose -f docker-compose.prod.yml up -d db
# Esperar 30-60 segundos
docker exec -i mision_emprende_db_prod mysql -u root -p$MYSQL_ROOT_PASSWORD mision_emprende_prod < "Dump20251203 (1).sql"
```

### Paso 3: Ejecutar

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Paso 4: Acceder

- Frontend: http://localhost
- Backend: http://localhost:8000/api

## Comandos Útiles

```bash
# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

