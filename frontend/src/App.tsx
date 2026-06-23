import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProfesorLogin } from './pages/profesor/Login';
import { ProfesorRegistro } from './pages/profesor/Registro';
import { ProfesorPanel } from './pages/profesor/Panel';
import { AdminPanel } from './pages/admin/Panel';
import { UpdateGame } from './pages/admin/UpdateGame';
import { UpdateGameEtapa1 } from './pages/admin/UpdateGameEtapa1';
import { UpdateGameEtapa2 } from './pages/admin/UpdateGameEtapa2';
import { UpdateGameEtapa3 } from './pages/admin/UpdateGameEtapa3';
import { UpdateGameEtapa4 } from './pages/admin/UpdateGameEtapa4';
import { Dashboard } from './pages/admin/Dashboard';
import { ManageProfessors } from './pages/admin/ManageProfessors';
import { ProfesorLobby } from './pages/profesor/Lobby';
import { ProfesorVideoInstitucional } from './pages/profesor/etapa1/VideoInstitucional';
import { ProfesorInstructivo } from './pages/profesor/etapa1/Instructivo';
import { ProfesorPersonalizacion } from './pages/profesor/etapa1/Personalizacion';
import { ProfesorPresentacion } from './pages/profesor/etapa1/Presentacion';
import { ProfesorResultadosEtapa1 } from './pages/profesor/etapa1/Resultados';
import { ProfesorSeleccionarTema } from './pages/profesor/etapa2/SeleccionarTema';
import { ProfesorBubbleMap } from './pages/profesor/etapa2/BubbleMap';
import { ProfesorPrototipo } from './pages/profesor/etapa3/Prototipo';
import { ProfesorFormularioPitch } from './pages/profesor/etapa4/FormularioPitch';
import { ProfesorPresentacionPitch } from './pages/profesor/etapa4/PresentacionPitch';
import { ProfesorReflexion } from './pages/profesor/Reflexion';
import { CrearSala } from './pages/profesor/CrearSala';
import { Historial } from './pages/profesor/Historial';
import { DetalleSesion } from './pages/profesor/DetalleSesion';
import { Objetivos } from './pages/profesor/Objetivos';
import { Tutorial } from './pages/profesor/Tutorial';
import { EtapaIntroPage } from './pages/profesor/EtapaIntro';
import { TabletJoin } from './pages/tablets/Join';
import { TabletLobby } from './pages/tablets/Lobby';
import { TabletLoadingScreen } from './pages/tablets/LoadingScreen';
import { TabletVideoInstitucional } from './pages/tablets/etapa1/VideoInstitucional';
import { TabletInstructivo } from './pages/tablets/etapa1/Instructivo';
import { TabletPersonalizacion } from './pages/tablets/etapa1/Personalizacion';
import { TabletPresentacion } from './pages/tablets/etapa1/Presentacion';
import { TabletMinijuego } from './pages/tablets/etapa1/Minijuego';
import { TabletResultadosEtapa1 } from './pages/tablets/etapa1/Resultados';
import { TabletSeleccionarTemaDesafioV2 } from './pages/tablets/etapa2/SeleccionarTemaDesafioV2';
import { TabletBubbleMapV2 } from './pages/tablets/etapa2/BubbleMapV2';
import { TabletPrototipoV2 } from './pages/tablets/etapa3/PrototipoV2';
import { TabletFormularioPitch } from './pages/tablets/etapa4/FormularioPitch';
import { TabletPresentacionPitch } from './pages/tablets/etapa4/PresentacionPitch';
import { TabletReflexion } from './pages/tablets/Reflexion';
import { SpaceWarpTransition } from './pages/tablets/SpaceWarpTransition';
import { PlanetLandingTransition } from './pages/tablets/PlanetLandingTransition';
import { MapaGalactico } from './pages/tablets/MapaGalactico';
import { FormularioEvaluacion } from './pages/evaluacion/Formulario';

function RedirectToSeleccionarTema() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Navigate to={`/profesor/etapa2/seleccionar-tema/${sessionId}`} replace />;
}

function App() {
  return (
    <>
    <Toaster position="top-right" richColors duration={4000} />
    <Routes>
      <Route path="/" element={<Navigate to="/tablet/join" replace />} />
      <Route path="/login" element={<Navigate to="/profesor/login" replace />} />
      <Route path="/panel" element={<Navigate to="/profesor/panel" replace />} />
      <Route path="/profesor/login" element={<ProfesorLogin />} />
      <Route path="/profesor/registro" element={<ProfesorRegistro />} />
      <Route path="/profesor/panel" element={<ProfesorPanel />} />
      <Route path="/profesor/crear-sala" element={<CrearSala />} />
      <Route path="/profesor/historial" element={<Historial />} />
      <Route path="/profesor/historial/:sessionId" element={<DetalleSesion />} />
      <Route path="/profesor/objetivos" element={<Objetivos />} />
      <Route path="/profesor/tutorial" element={<Tutorial />} />
      <Route path="/profesor/lobby/:sessionId" element={<ProfesorLobby />} />
      <Route path="/profesor/etapa/:etapaNumero/intro/:sessionId" element={<EtapaIntroPage />} />
      <Route path="/profesor/etapa1/video-institucional/:sessionId" element={<ProfesorVideoInstitucional />} />
      <Route path="/profesor/etapa1/instructivo/:sessionId" element={<ProfesorInstructivo />} />
      <Route path="/profesor/etapa1/personalizacion/:sessionId" element={<ProfesorPersonalizacion />} />
      <Route path="/profesor/etapa1/presentacion/:sessionId" element={<ProfesorPresentacion />} />
      <Route path="/profesor/resultados/:sessionId" element={<ProfesorResultadosEtapa1 />} />
      <Route path="/profesor/etapa2/seleccionar-tema/:sessionId" element={<ProfesorSeleccionarTema />} />
      <Route path="/profesor/etapa2/seleccionar-desafio/:sessionId" element={<RedirectToSeleccionarTema />} />
      <Route path="/profesor/etapa2/ver-desafio/:sessionId" element={<RedirectToSeleccionarTema />} />
      <Route path="/profesor/etapa2/bubble-map/:sessionId" element={<ProfesorBubbleMap />} />
      <Route path="/profesor/etapa3/prototipo/:sessionId" element={<ProfesorPrototipo />} />
      <Route path="/profesor/etapa4/formulario-pitch/:sessionId" element={<ProfesorFormularioPitch />} />
      <Route path="/profesor/etapa4/presentacion-pitch/:sessionId" element={<ProfesorPresentacionPitch />} />
      <Route path="/profesor/reflexion/:sessionId" element={<ProfesorReflexion />} />
      {/* Rutas de Administrador */}
      <Route path="/admin/login" element={<Navigate to="/profesor/login" replace />} />
      <Route path="/admin/panel" element={<AdminPanel />} />
      <Route path="/admin/update-game" element={<UpdateGame />} />
      <Route path="/admin/update-game/etapa1" element={<UpdateGameEtapa1 />} />
      <Route path="/admin/update-game/etapa2" element={<UpdateGameEtapa2 />} />
      <Route path="/admin/update-game/etapa3" element={<UpdateGameEtapa3 />} />
      <Route path="/admin/update-game/etapa4" element={<UpdateGameEtapa4 />} />
      <Route path="/admin/dashboard" element={<Dashboard />} />
      <Route path="/admin/professors" element={<ManageProfessors />} />
      <Route path="/admin/historial" element={<Historial />} />
      <Route path="/admin/historial/:sessionId" element={<DetalleSesion />} />
      <Route path="/admin/objetivos" element={<Objetivos />} />
      <Route path="/admin/tutorial" element={<Tutorial />} />
      <Route path="/tablet/join" element={<TabletJoin />} />
      <Route path="/tablet/join/:roomCode" element={<TabletJoin />} />
      <Route path="/tablet/lobby" element={<TabletLobby />} />
      <Route path="/tablet/loading" element={<TabletLoadingScreen />} />
      <Route path="/tablet/etapa-warp" element={<SpaceWarpTransition />} />
      <Route path="/tablet/etapa-transition" element={<PlanetLandingTransition />} />
      <Route path="/tablet/mapa-galactico" element={<MapaGalactico />} />
      <Route path="/tablet/etapa1/video-institucional" element={<TabletVideoInstitucional />} />
      <Route path="/tablet/etapa1/instructivo" element={<TabletInstructivo />} />
      <Route path="/tablet/etapa1/personalizacion" element={<TabletPersonalizacion />} />
      <Route path="/tablet/etapa1/presentacion" element={<TabletPresentacion />} />
      <Route path="/tablet/etapa1/minijuego" element={<TabletMinijuego />} />
      <Route path="/tablet/resultados" element={<TabletResultadosEtapa1 />} />
      <Route path="/tablet/etapa1/resultados" element={<TabletResultadosEtapa1 />} />
      <Route path="/tablet/etapa2/resultados" element={<TabletResultadosEtapa1 />} />
      <Route path="/tablet/etapa3/resultados" element={<TabletResultadosEtapa1 />} />
      <Route path="/tablet/etapa4/resultados" element={<TabletResultadosEtapa1 />} />
      <Route path="/tablet/etapa2/seleccionar-tema" element={<TabletSeleccionarTemaDesafioV2 />} />
      <Route path="/tablet/etapa2/bubble-map" element={<TabletBubbleMapV2 />} />
      <Route path="/tablet/etapa3/prototipo" element={<TabletPrototipoV2 />} />
      <Route path="/tablet/etapa4/formulario-pitch" element={<TabletFormularioPitch />} />
      <Route path="/tablet/etapa4/presentacion-pitch" element={<TabletPresentacionPitch />} />
      <Route path="/tablet/reflexion" element={<TabletReflexion />} />
      <Route path="/evaluacion/:roomCode" element={<FormularioEvaluacion />} />
      <Route path="*" element={<Navigate to="/tablet/join" replace />} />
    </Routes>
    </>
  );
}

export default App;


