import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Loader2,
  FileSpreadsheet,
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Users,
  Upload,
  Sparkles,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';

// ─── Estructura académica UDD ──────────────────────────────────────────────────
const uddStructure: Record<string, string[]> = {
  'Arquitectura y Arte': ['Arquitectura'],
  'Comunicaciones': [
    'Cine y Comunicación Audiovisual',
    'Periodismo',
    'Publicidad',
  ],
  'Derecho': ['Derecho'],
  'Diseño': [
    'Diseño de Espacios y Objetos',
    'Diseño de Interacción Digital',
    'Diseño Gráfico',
    'Diseño de Modas y Gestión',
  ],
  'Economía y Negocios': [
    'Ingeniería Comercial',
    'Global Business Administration',
  ],
  'Educación': [
    'Pedagogía en Educación Básica',
    'Pedagogía en Educación de Párvulos',
  ],
  'Gobierno': ['Ciencia Política y Políticas Públicas'],
  'Ingeniería': [
    'Ingeniería Civil Plan Común',
    'Ingeniería Civil Industrial',
    'Ingeniería Civil en Obras Civiles',
    'Ingeniería Civil en Minería',
    'Ingeniería Civil en Informática e Innovación Tecnológica',
    'Ingeniería Civil en Informática e Inteligencia Artificial',
    'Ingeniería Civil en BioMedicina',
    'Geología',
  ],
  'Medicina y Ciencias de la Salud': [
    'Enfermería',
    'Fonoaudiología',
    'Kinesiología',
    'Medicina',
    'Nutrición y Dietética',
    'Obstetricia',
    'Odontología',
    'Tecnología Médica',
    'Terapia Ocupacional',
  ],
  'Psicología': ['Psicología'],
};

const SECCIONES = [
  'Sección 1',
  'Sección 2',
  'Sección 3',
  'Sección 4',
  'Sección 5',
];

const FACULTADES = Object.keys(uddStructure);
console.log('[CrearSala] Facultades disponibles:', FACULTADES);

// ─── Custom Dropdown ───────────────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  icon: React.ReactNode;
}

function Dropdown({ label, placeholder, options, value, onChange, disabled = false, icon }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-semibold text-[#1B1B2F]/60 mb-1.5 flex items-center gap-1">
        {icon}
        {label}
      </p>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={[
          'w-full h-10 px-3 flex items-center justify-between gap-2 rounded-xl border text-sm transition-all',
          disabled
            ? 'bg-[#1B1B2F]/5 border-[#1B1B2F]/10 text-[#1B1B2F]/30 cursor-not-allowed'
            : open
            ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 text-[#1B1B2F]'
            : 'bg-white border-[#1B1B2F]/15 hover:border-[#2563EB]/50 text-[#1B1B2F]',
        ].join(' ')}
      >
        <span className={value ? 'text-[#1B1B2F]' : 'text-[#1B1B2F]/35'}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform text-[#1B1B2F]/40 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: 'top' }}
            className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white rounded-xl shadow-xl border border-[#1B1B2F]/10 py-1"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[#1B1B2F]/40 italic">
                Sin opciones disponibles
              </li>
            ) : (
              options.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={[
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      opt === value
                        ? 'bg-[#2563EB]/8 text-[#2563EB] font-semibold'
                        : 'text-[#1B1B2F] hover:bg-[#F5F0E8]',
                    ].join(' ')}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function CrearSala() {
  const navigate = useNavigate();

  const [selectedFacultad, setSelectedFacultad] = useState('');
  const [selectedCarrera, setSelectedCarrera] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [customCourse, setCustomCourse] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [processingExcel, setProcessingExcel] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    total_students: number;
    number_of_sessions: number;
    students_per_session: number;
    course_name: string;
  } | null>(null);

  const availableCarreras: string[] = selectedFacultad
    ? (uddStructure[selectedFacultad] ?? [])
    : [];

  const effectiveCourse =
    selectedCourse === '__custom__' ? customCourse : selectedCourse;

  const handleFacultadChange = (val: string) => {
    setSelectedFacultad(val);
    setSelectedCarrera('');
    setSelectedCourse('');
    setCustomCourse('');
    console.log('[CrearSala] Facultad:', val, '→ Carreras:', uddStructure[val]);
  };

  const handleCarreraChange = (val: string) => {
    setSelectedCarrera(val);
    setSelectedCourse('');
    setCustomCourse('');
  };

  const handleCourseChange = (val: string) => {
    setSelectedCourse(val);
    if (val !== '__custom__') setCustomCourse('');
  };

  const handleProcessExcel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFacultad || !selectedCarrera) {
      toast.error('Selecciona Facultad y Carrera antes de continuar');
      return;
    }
    if (!effectiveCourse.trim()) {
      toast.error('Selecciona o escribe el nombre del curso / sección');
      return;
    }
    if (!excelFile) {
      toast.error('Por favor selecciona un archivo Excel');
      return;
    }

    setProcessingExcel(true);
    try {
      const formData = new FormData();
      formData.append('course_name', effectiveCourse.trim());
      formData.append('faculty_name', selectedFacultad);
      formData.append('career_name', selectedCarrera);
      formData.append('file', excelFile);

      const response = await sessionsAPI.processExcel(formData);
      setSessionInfo({
        total_students: response.total_students,
        number_of_sessions: response.number_of_sessions,
        students_per_session: response.students_per_session,
        course_name: response.course_name,
      });
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Error al procesar el archivo Excel';
      toast.error(msg);
    } finally {
      setProcessingExcel(false);
    }
  };

  const handleConfirmCreateSessions = async (numberOfSessions: number) => {
    if (!excelFile || !effectiveCourse.trim()) {
      toast.error('Faltan datos necesarios');
      return;
    }

    setCreatingSession(true);
    try {
      const formData = new FormData();
      formData.append('course_name', effectiveCourse.trim());
      formData.append('faculty_name', selectedFacultad);
      formData.append('career_name', selectedCarrera);
      formData.append('file', excelFile);
      formData.append('number_of_sessions', numberOfSessions.toString());
      formData.append('min_team_size', '3');
      formData.append('max_team_size', '8');

      const response = await sessionsAPI.createWithExcel(formData);
      toast.success(response.message || 'Sesiones creadas exitosamente');

      if (numberOfSessions === 1) {
        const id = response.game_session?.id || response.id;
        navigate(`/profesor/lobby/${id}`);
      } else {
        const gameSessions = response.game_sessions ?? [];
        if (gameSessions.length > 0) navigate(`/profesor/lobby/${gameSessions[0].id}`);
        for (let i = 1; i < gameSessions.length; i++) {
          window.open(
            `${window.location.origin}/profesor/lobby/${gameSessions[i].id}`,
            '_blank',
          );
        }
        toast.success(
          `${gameSessions.length} salas creadas. Se abrieron ${gameSessions.length} pestañas.`,
        );
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Error al crear las sesiones';
      toast.error(msg);
    } finally {
      setCreatingSession(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.1 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.08 }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(150px)', opacity: 0.08 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 sm:p-6">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/profesor/panel')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#1B1B2F]/55 hover:text-[#1B1B2F] transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-4 mb-7"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#FF3D2E] to-rose-500 rounded-2xl flex items-center justify-center shadow-sm">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Nueva Sesión
            </h1>
            <p className="text-sm text-[#1B1B2F]/45">
              Configura y lanza tu partida de Misión Emprende
            </p>
          </div>
        </motion.div>

        {/* ── FORMULARIO ── */}
        {!sessionInfo ? (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 22 }}
            onSubmit={handleProcessExcel}
            className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-white/80 p-5 sm:p-6 space-y-6"
          >
            {/* Información Académica */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
                  <GraduationCap className="w-3.5 h-3.5 text-[#2563EB]" />
                </div>
                <h3
                  className="text-xs font-black text-[#1B1B2F] uppercase tracking-widest"
                  style={{ fontFamily: 'Unbounded, sans-serif' }}
                >
                  Información Académica
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Facultad */}
                <Dropdown
                  label="Facultad"
                  placeholder="Seleccionar…"
                  options={FACULTADES}
                  value={selectedFacultad}
                  onChange={handleFacultadChange}
                  icon={<GraduationCap className="w-3 h-3 text-[#FF3D2E]" />}
                />

                {/* Carrera */}
                <Dropdown
                  label="Carrera"
                  placeholder={selectedFacultad ? 'Seleccionar…' : 'Elige Facultad primero'}
                  options={availableCarreras}
                  value={selectedCarrera}
                  onChange={handleCarreraChange}
                  disabled={!selectedFacultad}
                  icon={<BookOpen className="w-3 h-3 text-[#2563EB]" />}
                />

                {/* Sección */}
                <div>
                  <Dropdown
                    label="Sección"
                    placeholder={selectedCarrera ? 'Seleccionar…' : 'Elige Carrera primero'}
                    options={[...SECCIONES, 'Otra sección…']}
                    value={selectedCourse === '__custom__' ? 'Otra sección…' : selectedCourse}
                    onChange={(val) =>
                      handleCourseChange(val === 'Otra sección…' ? '__custom__' : val)
                    }
                    disabled={!selectedCarrera}
                    icon={<Users className="w-3 h-3 text-[#F5A623]" />}
                  />
                  {selectedCourse === '__custom__' && (
                    <input
                      type="text"
                      placeholder="Ej: Sección A — Semestre 1"
                      value={customCourse}
                      onChange={(e) => setCustomCourse(e.target.value)}
                      autoFocus
                      className="mt-2 w-full h-10 px-3 rounded-xl border-2 border-[#2563EB]/40 bg-white text-sm text-[#1B1B2F] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Estudiantes (Excel) */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
                  <Upload className="w-3.5 h-3.5 text-[#F5A623]" />
                </div>
                <h3
                  className="text-xs font-black text-[#1B1B2F] uppercase tracking-widest"
                  style={{ fontFamily: 'Unbounded, sans-serif' }}
                >
                  Estudiantes
                </h3>
              </div>

              <label
                htmlFor="excelFile"
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#1B1B2F]/15 hover:border-[#2563EB]/40 rounded-2xl p-6 cursor-pointer transition-all bg-[#F5F0E8]/50 hover:bg-[#2563EB]/5 group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-[#2563EB] to-cyan-500 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#1B1B2F]/70">
                    Archivo Excel con Estudiantes
                  </p>
                  <p className="text-xs text-[#1B1B2F]/40 mt-0.5">
                    Columnas:{' '}
                    <strong className="text-[#1B1B2F]/60">Nombre completo</strong>,{' '}
                    <strong className="text-[#1B1B2F]/60">Correo UDD</strong>,{' '}
                    <strong className="text-[#1B1B2F]/60">RUT</strong>
                  </p>
                </div>
                <input
                  id="excelFile"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="hidden"
                  required
                />
                {excelFile ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {excelFile.name}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#2563EB] bg-[#2563EB]/8 px-4 py-1.5 rounded-full">
                    Seleccionar archivo .xlsx
                  </span>
                )}
              </label>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={processingExcel}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF3D2E] to-rose-500 hover:from-rose-500 hover:to-[#FF3D2E] text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingExcel ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Continuar
                  <Sparkles className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </motion.form>
        ) : (
          /* ── CONFIRMACIÓN ── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-white/80 p-5 sm:p-6 space-y-5"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mb-1">
                Confirmación
              </p>
              <h2
                className="text-lg font-black text-[#1B1B2F]"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                Resumen de Sesiones
              </h2>
            </div>

            <div className="space-y-0">
              {[
                { label: 'Total de estudiantes', value: sessionInfo.total_students },
                { label: 'Curso', value: sessionInfo.course_name },
                { label: 'Salas necesarias', value: sessionInfo.number_of_sessions },
                {
                  label: 'Estudiantes por sala (aprox.)',
                  value: sessionInfo.students_per_session,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2.5 border-b border-[#1B1B2F]/6 last:border-0"
                >
                  <span className="text-xs text-[#1B1B2F]/50">{row.label}</span>
                  <span className="text-sm font-bold text-[#1B1B2F]">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() =>
                  handleConfirmCreateSessions(sessionInfo.number_of_sessions)
                }
                disabled={creatingSession}
                className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF3D2E] to-rose-500 text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando sesiones…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Confirmar y crear{' '}
                    {sessionInfo.number_of_sessions === 1
                      ? '1 sala'
                      : `${sessionInfo.number_of_sessions} salas`}
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => setSessionInfo(null)}
                disabled={creatingSession}
                className="w-full h-10 text-xs font-semibold text-[#1B1B2F]/50 hover:text-[#1B1B2F]/80 rounded-2xl border border-[#1B1B2F]/12 hover:bg-white/80 transition-all disabled:opacity-40"
              >
                Volver al formulario
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
