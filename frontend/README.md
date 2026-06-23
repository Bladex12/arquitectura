# Misión Emprende - Frontend

Frontend React para el sistema de juego educativo **Misión Emprende**.

## 🚀 Tecnologías

- **React 18.3.1** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite 6.3.5** - Build tool y dev server
- **Tailwind CSS** - Framework CSS
- **React Router** - Enrutamiento
- **Framer Motion** - Animaciones
- **Axios** - Cliente HTTP
- **Sonner** - Notificaciones toast
- **Radix UI** - Componentes accesibles
- **Lucide React** - Iconos

## 📦 Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```

3. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

   El servidor estará disponible en `http://localhost:5173`

## 🏗️ Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/          # Componentes UI reutilizables
│   ├── pages/
│   │   └── profesor/    # Páginas del profesor
│   ├── services/
│   │   └── api.ts       # Cliente API y funciones de autenticación
│   ├── lib/
│   │   └── utils.ts     # Utilidades
│   ├── App.tsx          # Componente principal y rutas
│   ├── main.tsx         # Punto de entrada
│   └── index.css        # Estilos globales
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## 🔌 Integración con Backend

El frontend está configurado para usar las mismas APIs que el backend Django:

- **Login**: `POST /api/auth/token/`
- **Registro**: `POST /api/auth/professors/`
- **Perfil**: `GET /api/auth/professors/me/`
- **Refresh Token**: `POST /api/auth/token/refresh/`

El proxy de Vite está configurado para redirigir `/api` a `http://localhost:8000/api`.

## 📝 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción

## 🎨 Componentes UI

Los componentes UI están basados en **Radix UI** y **shadcn/ui**:
- `Button` - Botón con variantes
- `Input` - Campo de entrada
- `Label` - Etiqueta de formulario

## 🔐 Autenticación

El token JWT se almacena en `localStorage`:
- `authToken` - Token de acceso
- `refreshToken` - Token de refresco

El interceptor de Axios añade automáticamente el token a todas las peticiones autenticadas.

## 📱 Páginas

- `/profesor/login` - Login del profesor
- `/profesor/registro` - Registro del profesor

## 🚀 Próximos Pasos

- [ ] Página Home del profesor
- [ ] Página de Crear Sala
- [ ] Página Lobby
- [ ] Páginas de etapas del juego
- [ ] Páginas de tablets



