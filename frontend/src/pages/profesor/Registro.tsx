import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Key, BookOpen, Loader2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '@/services';
import { toast } from 'sonner';

export function ProfesorRegistro() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    codigo: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones igual que en login.html
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      // Usa exactamente la misma API que tienes en login.html
      // Validar que el código de acceso esté presente
      if (!formData.codigo || formData.codigo.trim() === '') {
        toast.error('El código de acceso es requerido para registrarse');
        return;
      }

      await authAPI.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.nombre,
        last_name: formData.apellidos,
        access_code: formData.codigo.trim(), // Código obligatorio
      });

      toast.success('¡Cuenta creada exitosamente! 🎉', {
        description: 'Iniciando sesión automáticamente...',
      });

      // Login automático después del registro (igual que en login.html - líneas 413-429)
      setTimeout(async () => {
        try {
          // Extraer username del email (igual que en login.html)
          const username = formData.email.includes('@') ? formData.email.split('@')[0] : formData.email;
          
          const loginData = await authAPI.login(formData.email, formData.password);
          
          // Guardar tokens
          localStorage.setItem('authToken', loginData.access);
          localStorage.setItem('refreshToken', loginData.refresh);

          toast.success('¡Sesión iniciada!', {
            description: 'Redirigiendo al panel...',
          });

          // Redirigir al panel (igual que en login.html - línea 425)
          setTimeout(() => navigate('/profesor/panel'), 500);
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Error al iniciar sesión';
          toast.error('Registro exitoso pero error al iniciar sesión', {
            description: errorMessage,
          });
          // Si falla el login, redirigir al login manual
          setTimeout(() => navigate('/profesor/login'), 2000);
        }
      }, 1000);
    } catch (error: any) {
      // Manejo de errores igual que en login.html
      let errorMessage = 'Error al registrar';
      if (error.response?.data) {
        const data = error.response.data;
        if (data.email) {
          errorMessage = Array.isArray(data.email) ? data.email[0] : data.email;
        } else if (data.username) {
          errorMessage = Array.isArray(data.username) ? data.username[0] : data.username;
        } else if (data.detail) {
          errorMessage = data.detail;
        }
      }
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Mismo fondo animado que Login */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Contenido */}
      <div className="relative z-10 h-screen flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 space-y-2.5 sm:space-y-3">
            {/* Header */}
            <div className="text-center space-y-1.5 sm:space-y-2">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-[#f757ac] mx-auto drop-shadow-lg" />
              <h1 className="text-lg sm:text-xl font-bold text-[#093c92]">
                Crear Cuenta de Profesor
              </h1>
              <p className="text-gray-600 text-xs font-medium">
                Área exclusiva para <span className="text-[#093c92] font-bold">Profesores UDD</span>
              </p>
              <p className="text-gray-500 text-[10px] sm:text-xs">
                Únete a <span className="text-[#f757ac] font-semibold">Misión Emprende</span>
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="nombre" className="text-xs">Nombres</Label>
                  <div className="relative">
                    <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      id="nombre"
                      placeholder="Juan"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="pl-8 h-9 text-xs"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apellidos" className="text-xs">Apellidos</Label>
                  <Input
                    id="apellidos"
                    placeholder="Pérez"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    className="h-9 text-xs"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Correo UDD</Label>
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu.correo@udd.cl"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-8 h-9 text-xs"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="codigo" className="flex items-center gap-1 text-xs">
                  <Key className="w-3 h-3 text-[#093c92]" />
                  <span className="text-[10px]">Código de Acceso <span className="text-red-500">*</span></span>
                </Label>
                <div className="relative">
                  <Key className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    id="codigo"
                    placeholder="Ingresa el código de acceso recibido"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="pl-8 h-9 text-xs"
                    required
                    disabled={loading}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  El código de acceso es requerido para registrarse como profesor
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mín. 8"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-8 h-9 text-xs"
                      required
                      minLength={8}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs">Confirmar</Label>
                  <div className="relative">
                    <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="pl-8 h-9 text-xs"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-[#f757ac] hover:bg-[#f757ac]/90 text-white shadow-lg hover:shadow-xl text-xs mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-3.5 h-3.5 mr-2" />
                    Crear Cuenta
                  </>
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center space-y-1 pt-1.5 border-t border-gray-200">
              <p className="text-gray-500 text-[10px]">
                ¿Ya tienes una cuenta de profesor?
              </p>
              <button
                onClick={() => navigate('/profesor/login')}
                className="text-[#093c92] hover:text-[#f757ac] transition-colors font-semibold text-xs"
                disabled={loading}
              >
                Inicia sesión <span className="underline">aquí</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


