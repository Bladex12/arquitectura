import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  GraduationCap,
  Plus,
  Mail,
  Key,
  Loader2,
  X,
  User,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
} from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Professor {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  access_code: string;
  full_name: string;
  created_at: string;
}

interface AccessCode {
  id: number;
  email: string;
  access_code: string;
  is_used: boolean;
  created_at: string;
  used_at: string | null;
}

export function ManageProfessors() {
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'professors' | 'codes'>('professors');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadProfessors(), loadAccessCodes()]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfessors = async () => {
    try {
      const response = await api.get('/auth/professors/');
      setProfessors(response.data.results || response.data);
    } catch (error: any) {
      console.error('Error al cargar profesores:', error);
      toast.error('Error al cargar la lista de profesores');
      throw error;
    }
  };

  const loadAccessCodes = async () => {
    try {
      const response = await api.get('/auth/professors/access_codes/');
      setAccessCodes(response.data.results || response.data);
    } catch (error: any) {
      console.error('Error al cargar códigos de acceso:', error);
      setAccessCodes([]);
    }
  };

  const handleCreateAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error('El correo electrónico es requerido');
      return;
    }
    if (!formData.email.endsWith('@udd.cl')) {
      toast.error('El correo debe ser de la universidad (@udd.cl)');
      return;
    }

    try {
      setCreating(true);
      const response = await api.post('/auth/professors/create_with_code/', {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });

      window.location.href = response.data.mailto_link;
      toast.success('Código generado. Se abrió tu cliente de correo con el mensaje formateado.');

      setShowModal(false);
      setFormData({ email: '', first_name: '', last_name: '' });
      await loadAccessCodes();
    } catch (error: any) {
      console.error('Error al generar código:', error);
      toast.error(error.response?.data?.error || 'Error al generar el código de acceso');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredProfessors = professors.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.user.email?.toLowerCase().includes(q) ||
      p.user.username?.toLowerCase().includes(q)
    );
  });

  const filteredCodes = accessCodes.filter((c) =>
    c.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tabs: { key: 'professors' | 'codes'; label: string; count: number }[] = [
    { key: 'professors', label: 'Profesores', count: professors.length },
    { key: 'codes', label: 'Códigos de Acceso', count: accessCodes.length },
  ];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.11 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.08 }}
      />
      <div
        className="absolute top-[40%] right-[8%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(150px)', opacity: 0.09 }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 sm:p-6">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/admin/panel')}
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-6 rounded-full bg-[#2563EB]" />
              <h1
                className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                Gestión de Profesores
              </h1>
            </div>
            <p className="text-sm text-[#1B1B2F]/45 ml-4">
              Administra los profesores con acceso al sistema
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2563EB] text-white text-sm font-bold shadow-sm hover:bg-[#1d4ed8] transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Generar Código de Acceso
          </motion.button>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative mb-4"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B1B2F]/35" />
          <input
            type="text"
            placeholder={activeTab === 'professors' ? 'Buscar por nombre o correo…' : 'Buscar por correo…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-2xl border border-[#1B1B2F]/10 bg-white/80 backdrop-blur-sm text-sm text-[#1B1B2F] placeholder:text-[#1B1B2F]/35 focus:outline-none focus:border-[#2563EB]/40 focus:ring-2 focus:ring-[#2563EB]/10 transition-all"
          />
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="flex gap-2 mb-4"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[#1B1B2F] text-white shadow-sm'
                  : 'bg-white/70 text-[#1B1B2F]/55 hover:bg-white/90 border border-[#1B1B2F]/8'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-white/20' : 'bg-[#1B1B2F]/8'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Content card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm flex-1 overflow-hidden"
          style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
            </div>
          ) : activeTab === 'professors' ? (
            filteredProfessors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <GraduationCap className="w-12 h-12 text-[#1B1B2F]/20" />
                <p className="text-sm text-[#1B1B2F]/40">
                  {searchQuery ? 'Sin resultados para tu búsqueda' : 'No hay profesores registrados'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b border-[#1B1B2F]/6">
                      <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                        Profesor
                      </th>
                      <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                        Correo
                      </th>
                      <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                        Código
                      </th>
                      <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                        Registro
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfessors.map((professor, i) => (
                      <motion.tr
                        key={professor.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[#1B1B2F]/4 hover:bg-[#F5F0E8]/50 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-[#2563EB]" />
                            </div>
                            <span className="font-semibold text-sm text-[#1B1B2F]">
                              {professor.full_name || professor.user.username}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2 text-sm text-[#1B1B2F]/60">
                            <Mail className="w-3.5 h-3.5 text-[#1B1B2F]/30" />
                            {professor.user.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-mono text-xs font-bold text-[#1B1B2F]/80 bg-[#F5F0E8] px-2.5 py-1 rounded-lg border border-[#1B1B2F]/8">
                            {professor.access_code || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-1.5 text-xs text-[#1B1B2F]/45">
                            <Calendar className="w-3 h-3" />
                            {formatDate(professor.created_at)}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Key className="w-12 h-12 text-[#1B1B2F]/20" />
              <p className="text-sm text-[#1B1B2F]/40">
                {searchQuery ? 'Sin resultados para tu búsqueda' : 'No hay códigos de acceso generados'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="border-b border-[#1B1B2F]/6">
                    <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                      Correo
                    </th>
                    <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                      Código
                    </th>
                    <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                      Estado
                    </th>
                    <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                      Creado
                    </th>
                    <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/45">
                      Usado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map((code, i) => {
                    const professorRegistered = professors.some(
                      (p) => p.user.email.toLowerCase() === code.email.toLowerCase(),
                    );
                    return (
                      <motion.tr
                        key={code.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[#1B1B2F]/4 hover:bg-[#F5F0E8]/50 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2 text-sm text-[#1B1B2F]/70">
                            <Mail className="w-3.5 h-3.5 text-[#1B1B2F]/30" />
                            {code.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-mono text-xs font-bold text-[#1B1B2F]/80 bg-[#F5F0E8] px-2.5 py-1 rounded-lg border border-[#1B1B2F]/8">
                            {code.access_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {code.is_used && professorRegistered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Registrado
                            </span>
                          ) : code.is_used ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-[#2563EB]">
                              <CheckCircle2 className="w-3 h-3" />
                              Usado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#1B1B2F]/45">
                          {formatDate(code.created_at)}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#1B1B2F]/45">
                          {code.used_at ? formatDate(code.used_at) : '—'}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal para crear código */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop + flex centerer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setFormData({ email: '', first_name: '', last_name: '' }); }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B1B2F]/40 backdrop-blur-sm px-4"
            >
            {/* Modal card — stopPropagation para que el click interno no cierre el modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
              style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
            >
              {/* Header stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#2563EB] via-[#FF3D2E] to-[#F5A623]" />

              <div className="p-6 sm:p-7">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2
                      className="text-base font-black text-[#1B1B2F]"
                      style={{ fontFamily: 'Unbounded, sans-serif' }}
                    >
                      Agregar Nuevo Profesor
                    </h2>
                    <p className="text-xs text-[#1B1B2F]/45 mt-0.5">
                      Se generará un código de acceso y se abrirá tu cliente de correo
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowModal(false); setFormData({ email: '', first_name: '', last_name: '' }); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F5F0E8] text-[#1B1B2F]/40 hover:text-[#1B1B2F] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateAccessCode} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/55 mb-2">
                      Correo UDD <span className="text-[#FF3D2E]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B1B2F]/30" />
                      <input
                        type="email"
                        placeholder="nombre.apellido@udd.cl"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={creating}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#1B1B2F]/12 bg-[#F5F0E8]/60 text-sm text-[#1B1B2F] placeholder:text-[#1B1B2F]/30 focus:outline-none focus:border-[#2563EB]/50 focus:ring-2 focus:ring-[#2563EB]/10 transition-all disabled:opacity-50"
                      />
                    </div>
                    <p className="text-[10px] text-[#1B1B2F]/40 mt-1">Debe ser un correo @udd.cl</p>
                  </div>

                  {/* Name fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/55 mb-2">
                        Nombre
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B1B2F]/30" />
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          disabled={creating}
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#1B1B2F]/12 bg-[#F5F0E8]/60 text-sm text-[#1B1B2F] placeholder:text-[#1B1B2F]/30 focus:outline-none focus:border-[#2563EB]/50 focus:ring-2 focus:ring-[#2563EB]/10 transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-[#1B1B2F]/55 mb-2">
                        Apellido
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B1B2F]/30" />
                        <input
                          type="text"
                          placeholder="Apellido"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          disabled={creating}
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#1B1B2F]/12 bg-[#F5F0E8]/60 text-sm text-[#1B1B2F] placeholder:text-[#1B1B2F]/30 focus:outline-none focus:border-[#2563EB]/50 focus:ring-2 focus:ring-[#2563EB]/10 transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-2.5 bg-[#F5F0E8] rounded-xl p-3.5 border border-[#1B1B2F]/6">
                    <AlertCircle className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-[#1B1B2F]/60">
                      <p className="font-semibold text-[#1B1B2F]/80 mb-1">¿Cómo funciona?</p>
                      <ul className="space-y-0.5 list-disc list-inside">
                        <li>Se genera un código de acceso de 6 dígitos</li>
                        <li>Tu cliente de correo se abre con el mensaje listo</li>
                        <li>El profesor usa el código para registrarse</li>
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <motion.button
                      type="submit"
                      disabled={creating}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 h-11 rounded-2xl bg-[#2563EB] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generando…
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Generar Código
                        </>
                      )}
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setFormData({ email: '', first_name: '', last_name: '' }); }}
                      disabled={creating}
                      className="px-5 h-11 rounded-2xl border border-[#1B1B2F]/12 text-sm font-semibold text-[#1B1B2F]/60 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
