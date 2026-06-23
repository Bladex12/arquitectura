import { AnimatePresence, motion } from 'framer-motion';

interface AdvanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function AdvanceConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}: AdvanceConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-md rounded-[24px] border border-white/10 bg-[#11131D]/95 shadow-[0_0_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-6 py-5">
                <h2
                  className="mb-3 text-sm uppercase tracking-[0.35em] text-white"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  {title}
                </h2>
                <p
                  className="mb-6 text-sm leading-6 text-slate-300"
                  style={{ fontFamily: "'Exo 2', sans-serif" }}
                >
                  {message}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="min-h-[44px] flex-1 rounded-2xl bg-gradient-to-r from-[#3B6EE9] via-[#6C3DD1] to-[#C32ED2] px-4 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_20px_50px_rgba(106,60,215,0.28)] transition hover:brightness-110"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    Avanzar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
