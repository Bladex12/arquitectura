import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CancelSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, reasonOther?: string) => void;
  currentStage?: string | null;
  currentActivity?: string | null;
  roomCode?: string;
}

const CANCELLATION_REASONS = [
  'Faltó tiempo',
  'Probando el juego',
  'Problemas técnicos',
  'Cambio de planes',
  'Otro',
];

export function CancelSessionModal({
  isOpen,
  onClose,
  onConfirm,
  currentStage,
  currentActivity,
  roomCode,
}: CancelSessionModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedReason) {
      setError('Por favor selecciona un motivo de cancelación');
      return;
    }

    if (selectedReason === 'Otro' && !otherReason.trim()) {
      setError('Por favor describe el motivo de cancelación');
      return;
    }

    setError('');
    onConfirm(selectedReason, selectedReason === 'Otro' ? otherReason : undefined);
    // Reset form
    setSelectedReason('');
    setOtherReason('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setOtherReason('');
    setError('');
    onClose();
  };

  const getCurrentLocation = () => {
    if (currentStage && currentActivity) {
      return `Etapa ${currentStage} - ${currentActivity}`;
    }
    if (currentStage) {
      return `Etapa ${currentStage}`;
    }
    if (currentActivity) {
      return currentActivity;
    }
    return 'Lobby';
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Cancelar Sesión
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {roomCode && (
            <p className="text-sm text-gray-600 mb-4">
              Sala: <span className="font-semibold">{roomCode}</span>
            </p>
          )}

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">Hasta dónde llegó:</span>
            </p>
            <p className="text-sm text-blue-800 font-medium">
              {getCurrentLocation()}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo de cancelación <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecciona un motivo</option>
              {CANCELLATION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Otro' && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Describe el motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={otherReason}
                onChange={(e) => {
                  setOtherReason(e.target.value);
                  setError('');
                }}
                placeholder="Escribe el motivo de cancelación..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Cancelación
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}











