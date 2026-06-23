import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send, AlertCircle, GraduationCap, BookOpen, Instagram, Facebook, Linkedin, Mail, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { academicAPI, reflectionEvaluationsAPI } from '@/services';
import { toast } from 'sonner';

interface Faculty {
  id: number;
  name: string;
}

interface Career {
  id: number;
  name: string;
}

const VALUE_AREAS = [
  'Resolver desafios',
  'Trabajar en equipo',
  'Empatizar',
  'Ser creativo',
  'Comunicar mis ideas'
];

const SATISFACTION_OPTIONS = [
  { value: 'mucho', label: 'Sí, mucho' },
  { value: 'si', label: 'Sí' },
  { value: 'masomenos', label: 'Más o menos' },
  { value: 'nomucho', label: 'No mucho' },
  { value: 'no', label: 'No' }
];

const ENTREPRENEURSHIP_OPTIONS = [
  { value: 'ya_tenia', label: 'Ya tenía ganas de emprender antes de la actividad' },
  { value: 'me_encantaria', label: 'Sí, me encantaría emprender' },
  { value: 'posible_opcion', label: 'Ahora lo veo como una posible opción' },
  { value: 'no_interesa', label: 'No, sigue sin interesarme' }
];

export function FormularioEvaluacion() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [formData, setFormData] = useState({
    student_name: '',
    student_email: '',
    faculty: '',
    career: '',
    value_areas: [] as string[],
    satisfaction: '',
    entrepreneurship_interest: '',
    comments: ''
  });

  useEffect(() => {
    loadFaculties();
  }, []);

  const loadFaculties = async () => {
    try {
      setLoadingData(true);
      const data = await academicAPI.getFaculties();
      const facultiesArray = Array.isArray(data) ? data : [data];
      setFaculties(facultiesArray);
    } catch (error) {
      console.error('Error loading faculties:', error);
      toast.error('Error al cargar facultades');
    } finally {
      setLoadingData(false);
    }
  };

  const loadCareers = async (facultyId: string) => {
    if (!facultyId) {
      setCareers([]);
      setFormData(prev => ({ ...prev, career: '' }));
      return;
    }
    
    try {
      const data = await academicAPI.getCareers(facultyId);
      const careersArray = Array.isArray(data) ? data : [data];
      setCareers(careersArray);
      setFormData(prev => ({ ...prev, career: '' }));
    } catch (error) {
      console.error('Error loading careers:', error);
      toast.error('Error al cargar carreras');
    }
  };

  const handleValueAreaChange = (area: string) => {
    setFormData(prev => ({
      ...prev,
      value_areas: prev.value_areas.includes(area)
        ? prev.value_areas.filter(a => a !== area)
        : [...prev.value_areas, area]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.student_name || !formData.student_email) {
      toast.error('Por favor completa tu nombre y correo UDD');
      return;
    }

    setSubmitting(true);
    try {
      // Obtener nombres de facultad y carrera si se seleccionaron
      const facultyName = faculties.find(f => f.id.toString() === formData.faculty)?.name || '';
      const careerName = careers.find(c => c.id.toString() === formData.career)?.name || '';
      
      await reflectionEvaluationsAPI.create({
        room_code: roomCode,
        student_name: formData.student_name,
        student_email: formData.student_email,
        faculty: facultyName,
        career: careerName,
        value_areas: formData.value_areas,
        satisfaction: formData.satisfaction,
        entrepreneurship_interest: formData.entrepreneurship_interest,
        feedback: formData.comments
      });
      
      setSubmitted(true);
      toast.success('¡Gracias por tu evaluación!');
    } catch (error: any) {
      console.error('Error submitting evaluation:', error);
      toast.error(error.response?.data?.error || 'Error al enviar la evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4">
        {/* Fondo animado igual que Panel */}
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
          
          {/* Efectos de partículas adicionales */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full opacity-30"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                  y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
                }}
                animate={{
                  y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl w-full relative z-10"
        >
          <Card className="p-8 sm:p-12 text-center bg-gradient-to-br from-white/90 via-purple-50/90 to-pink-50/90 border-2 border-purple-200/50 shadow-2xl backdrop-blur-xl">
            {/* Icono de éxito animado */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
            >
              <CheckCircle2 className="w-14 h-14 text-white" />
            </motion.div>

            {/* Título */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4"
            >
              ¡Gracias por tu evaluación!
            </motion.h2>

            {/* Mensaje */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-blue-800 mb-8 font-medium"
            >
              Tu respuesta ha sido enviada correctamente. Tu opinión es muy valiosa para nosotros.
            </motion.p>

            {/* Separador decorativo */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-full mb-8 mx-auto max-w-xs shadow-lg"
            />

            {/* Redes sociales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-6"
            >
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 flex items-center justify-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Síguenos en nuestras redes
              </h3>
              <div className="flex justify-center gap-4 flex-wrap">
                {/* Instagram */}
                <motion.a
                  href="https://www.instagram.com/emprendeudd/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Instagram className="w-7 h-7 text-white" />
                </motion.a>

                {/* Facebook */}
                <motion.a
                  href="https://www.facebook.com/emprendeudd" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Facebook className="w-7 h-7 text-white" />
                </motion.a>

                {/* LinkedIn */}
                <motion.a
                  href="https://www.linkedin.com/company/emprendeudd" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-blue-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Linkedin className="w-7 h-7 text-white" />
                </motion.a>

                {/* Email */}
                <motion.a
                  href="mailto:emprende@udd.cl" 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Mail className="w-7 h-7 text-white" />
                </motion.a>
              </div>
            </motion.div>

            {/* Información adicional */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 pt-6 border-t-2 border-purple-300/50"
            >
              <p className="text-sm font-semibold text-purple-800">
                Dirección de Emprendimiento UDD
              </p>
              <p className="text-xs text-purple-600 mt-2 font-medium">
                Universidad del Desarrollo
              </p>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo animado igual que Panel */}
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
        
        {/* Efectos de partículas adicionales */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              }}
              animate={{
                y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full relative z-10 p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-md">
            Evaluación Misión Emprende
          </h1>
          <p className="text-white/90 text-sm sm:text-base drop-shadow-sm">
            Dirección de Emprendimiento UDD
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 sm:p-8 bg-gradient-to-br from-white/90 via-purple-50/90 to-pink-50/90 backdrop-blur-xl border-2 border-purple-200/50 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre y Apellido */}
              <div>
                <Label htmlFor="student_name" className="text-sm font-medium text-purple-800">
                  1. Nombre y apellido
                </Label>
                <Input
                  id="student_name"
                  type="text"
                  value={formData.student_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
                  className="mt-2 bg-white/30 backdrop-blur-sm border-purple-300/50 hover:bg-purple-50/50 focus-visible:border-pink-500 focus-visible:ring-pink-500/30"
                  placeholder="Escriba su respuesta"
                  required
                />
              </div>

              {/* Correo UDD */}
              <div>
                <Label htmlFor="student_email" className="text-sm font-medium text-purple-800">
                  2. Correo UDD
                </Label>
                <Input
                  id="student_email"
                  type="email"
                  value={formData.student_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_email: e.target.value }))}
                  className="mt-2 bg-white/30 backdrop-blur-sm border-purple-300/50 hover:bg-purple-50/50 focus-visible:border-pink-500 focus-visible:ring-pink-500/30"
                  placeholder="Escriba su respuesta"
                  required
                />
              </div>

              {/* Facultad */}
              <div>
                <Label htmlFor="faculty" className="text-sm font-medium text-purple-800 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-pink-500" />
                  3. Facultad
                </Label>
                <select
                  id="faculty"
                  value={formData.faculty}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, faculty: e.target.value }));
                    loadCareers(e.target.value);
                  }}
                  className="w-full h-12 px-4 border-2 border-purple-300/50 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 transition-all text-sm bg-white/30 backdrop-blur-sm hover:bg-purple-50/50 hover:border-pink-400/60 mt-2"
                  disabled={loadingData}
                >
                  <option value="">Seleccionar Facultad...</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Carrera */}
              <div>
                <Label htmlFor="career" className="text-sm font-medium text-purple-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  4. Carrera
                </Label>
                <select
                  id="career"
                  value={formData.career}
                  onChange={(e) => setFormData(prev => ({ ...prev, career: e.target.value }))}
                  disabled={!formData.faculty || loadingData}
                  className="w-full h-12 px-4 border-2 border-white/40 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all text-sm bg-white/30 backdrop-blur-sm hover:bg-white/40 hover:border-white/60 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  <option value="">
                    {formData.faculty ? 'Seleccionar Carrera...' : 'Primero selecciona una Facultad'}
                  </option>
                  {careers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Áreas de Valor */}
              <div>
                <Label className="text-sm font-medium text-purple-800 mb-3 block">
                  5. Esta actividad me aportó valor principalmente para entender y trabajar: (Puedes marcar más de 1 opción)
                </Label>
                <div className="space-y-2 mt-2">
                  {VALUE_AREAS.map((area) => (
                    <label
                      key={area}
                      className="flex items-center gap-3 p-3 rounded-lg border border-purple-200/50 hover:bg-gradient-to-r hover:from-pink-50/60 hover:to-purple-50/60 backdrop-blur-sm cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={formData.value_areas.includes(area)}
                        onChange={() => handleValueAreaChange(area)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{area}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Satisfacción */}
              <div>
                <Label className="text-sm font-medium text-purple-800 mb-3 block">
                  6. Te gustó la actividad realizada?
                </Label>
                <div className="space-y-2 mt-2">
                  {SATISFACTION_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg border border-purple-200/50 hover:bg-gradient-to-r hover:from-pink-50/60 hover:to-purple-50/60 backdrop-blur-sm cursor-pointer transition-all"
                    >
                      <input
                        type="radio"
                        name="satisfaction"
                        value={option.value}
                        checked={formData.satisfaction === option.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, satisfaction: e.target.value }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Interés en Emprender */}
              <div>
                <Label className="text-sm font-medium text-purple-800 mb-3 block">
                  7. Luego de esta actividad, ¿Se incrementaron tus ganas de querer emprender?
                </Label>
                <div className="space-y-2 mt-2">
                  {ENTREPRENEURSHIP_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg border border-purple-200/50 hover:bg-gradient-to-r hover:from-pink-50/60 hover:to-purple-50/60 backdrop-blur-sm cursor-pointer transition-all"
                    >
                      <input
                        type="radio"
                        name="entrepreneurship_interest"
                        value={option.value}
                        checked={formData.entrepreneurship_interest === option.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, entrepreneurship_interest: e.target.value }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Comentarios */}
              <div>
                <Label htmlFor="comments" className="text-sm font-medium text-purple-800">
                  8. Dejanos tus comentarios sobre la actividad o sobre tus intereses
                </Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className="mt-2 bg-white/30 backdrop-blur-sm border-purple-300/50 hover:bg-purple-50/50 focus-visible:border-pink-500 focus-visible:ring-pink-500/30"
                  placeholder="Escriba su respuesta"
                  rows={4}
                />
              </div>

              {/* Botón Enviar */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

