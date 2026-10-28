import { createBrowserRouter, useRouteError, useNavigate, Navigate } from "react-router";

function RedirCalendario() {
  return <Navigate to="/auditor/agenda?tab=calendario" replace />
}

function RootError() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        gap: '1rem',
        background: 'var(--background, #F8F9FA)',
      }}
    >
      <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text, #C02A2A)' }}>
        Algo salió mal. Tus datos guardados sin conexión siguen en la cola.
      </p>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="text-sm underline"
        style={{ color: 'var(--primary)' }}
      >
        Volver al inicio
      </button>
    </div>
  )
}

function InocuidadError() {
  const err = useRouteError() as Error | null
  const navigate = useNavigate()
  if (err) console.error('[InocuidadError]', err)
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 gap-4">
      <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text)' }}>
        Algo falló al mostrar esta pantalla. Tus datos guardados sin conexión siguen en la cola.
      </p>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="text-sm underline"
        style={{ color: 'var(--primary)' }}
      >
        Volver al inicio
      </button>
    </div>
  )
}
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { RequireOrg } from "./components/RequireOrg";
import { Login } from "./screens/Login";
import { Registro } from "./screens/Registro";
import { CompletarOrganizacion } from "./screens/CompletarOrganizacion";
import { Home } from "./screens/Home";
import { NuevaAplicacion } from "./screens/NuevaAplicacion";
import { Inventario } from "./screens/Inventario";
import { BibliotecaHistorial } from "./screens/BibliotecaHistorial";
import { Perfil } from "./screens/Perfil";
import { DetalleAplicacion } from "./screens/DetalleAplicacion";
import { BotiquinPrimerosAuxilios } from "./screens/BotiquinPrimerosAuxilios";
import { InspeccionVidrioPlastico } from "./screens/InspeccionVidrioPlastico";
import { RegistroFertilizacion } from "./screens/RegistroFertilizacion";
import { InspeccionPerimetral } from "./screens/InspeccionPerimetral";
import { RegistroCosechaLiberacion } from "./screens/RegistroCosechaLiberacion";
import { InspeccionPreoperacionalCosecha } from "./screens/InspeccionPreoperacionalCosecha";
import { RegistroLimpiezaBanos } from "./screens/RegistroLimpiezaBanos";
import { ReporteIncidencias } from "./screens/ReporteIncidencias";
import { MiOrganizacion } from "./screens/MiOrganizacion";
import { ActividadEquipo } from "./screens/ActividadEquipo";
import { AuditoriaSaia } from "./screens/AuditoriaSaia";
import { AuditoriaGranja } from "./screens/AuditoriaGranja";
import { AuditoriaCosecha } from "./screens/AuditoriaCosecha";
import { AuditoriaBPM } from "./screens/AuditoriaBPM";
import { AuditoriaHACCP } from "./screens/AuditoriaHACCP";
import { InspeccionPreoperacionalCooler } from "./screens/InspeccionPreoperacionalCooler";
import { RegistroAccidentesLaborales } from "./screens/RegistroAccidentesLaborales";
import { MonitoreoEstacionesPlagas } from "./screens/MonitoreoEstacionesPlagas";
import { RegistroMuestrasLaboratorio } from "./screens/RegistroMuestrasLaboratorio";
import { VerificacionInsumos } from "./screens/VerificacionInsumos"
import { MonitoreoGermicida } from "./screens/MonitoreoGermicida"
import { LimpiezaBanosQuimicos } from "./screens/LimpiezaBanosQuimicos"
import { LimpiezaAduana } from "./screens/LimpiezaAduana"
import { LimpiezaComedor } from "./screens/LimpiezaComedor"
import { LimpiezaOficinas } from "./screens/LimpiezaOficinas"
import { LimpiezaPatiosAzoteas } from "./screens/LimpiezaPatiosAzoteas"
import { LimpiezaRecepcion } from "./screens/LimpiezaRecepcion"
import { LimpiezaPreenfrio } from "./screens/LimpiezaPreenfrio"
import { LimpiezaAlmacenEmpaque } from "./screens/LimpiezaAlmacenEmpaque"
import { LimpiezaCisterna } from "./screens/LimpiezaCisterna"
import { ManifiestoEmbarque } from "./screens/ManifiestoEmbarque"
import { RecepcionFruta } from "./screens/RecepcionFruta"
import { EntradasSalidasPreFrio } from "./screens/EntradasSalidasPreFrio"
import { TemperaturasConservador } from "./screens/TemperaturasConservador"
import { MaterialEmpaqueMovimientos } from "./screens/MaterialEmpaqueMovimientos"
import { InspeccionAlmacenEmpaque } from "./screens/InspeccionAlmacenEmpaque"
import { OrdenMantenimiento } from "./screens/OrdenMantenimiento"
import { MantenimientoPreventivo } from "./screens/MantenimientoPreventivo"
import { PreparacionCloro } from "./screens/PreparacionCloro"
import { ControlInventarioQuimicos } from "./screens/ControlInventarioQuimicos";
import { ResumenNoConformidades } from "./screens/ResumenNoConformidades";
import { AccionesCorrectivas } from "./screens/AccionesCorrectivas";
import { RondinesVigilancia } from "./screens/RondinesVigilancia";
import { RegistroPersonal } from "./screens/RegistroPersonal";
import { TrazabilidadProducto } from "./screens/TrazabilidadProducto";
import { RequireModulo } from "./components/RequireModulo";
import { NfcEstacion } from "./screens/NfcEstacion";
import AuditoriasPrimusGFS from "./screens/AuditoriasPrimusGFS";
import { NuevaAuditoriaPGFS } from "./screens/NuevaAuditoriaPGFS";
import { CapturaAuditoriaPGFS } from "./screens/CapturaAuditoriaPGFS";
import { RestablecerContrasena } from "./screens/RestablecerContrasena"
import { CalibracionBombas } from "./screens/CalibracionBombas"
import { CalibracionEquipos } from "./screens/CalibracionEquipos"
import { CalibracionBasculas } from "./screens/CalibracionBasculas"
import { CalibracionVolumetricos } from "./screens/CalibracionVolumetricos";
import { ConsumoEnergia } from "./screens/ConsumoEnergia"
import { GestionResiduos } from "./screens/GestionResiduos"
import { FuentesAgua } from "./screens/FuentesAgua"
import { MipPreventivo } from "./screens/MipPreventivo"
import { MipObservacion } from "./screens/MipObservacion"
import { MipIntervencion } from "./screens/MipIntervencion"
import { FrecuenciaCapacitacion } from "./screens/FrecuenciaCapacitacion"
import { CronogramaCapacitacion } from "./screens/CronogramaCapacitacion"
import { UsoEpp } from "./screens/UsoEpp"
import { ControlHerramientas } from "./screens/ControlHerramientas"
import { SanitizacionCosecha } from "./screens/SanitizacionCosecha"
import { ProductosAutorizados } from "./screens/ProductosAutorizados"
import { Tensiometros } from "./screens/Tensiometros"
import { PlanSuelo } from "./screens/PlanSuelo"
import { FertilizacionGG } from "./screens/FertilizacionGG"
import { MonitoreoRoedores } from "./screens/MonitoreoRoedores"
import { VerificacionCosecha } from "./screens/VerificacionCosecha"
import { LimpiezaCampo } from "./screens/LimpiezaCampo"
import { VerificacionRoedores } from "./screens/VerificacionRoedores"
import { MonitoreoPlaguasEnfermedades } from "./screens/MonitoreoPlaguasEnfermedades"
import { BotiquinGG } from "./screens/BotiquinGG"
import { GermicidaGG } from "./screens/GermicidaGG"
import { AlmacenEmpaqueGG } from "./screens/AlmacenEmpaqueGG"
import { MantenimientoEquiposGG } from "./screens/MantenimientoEquiposGG"
import { EmpleadosGG } from "./screens/EmpleadosGG"
import { TrazabilidadGG } from "./screens/TrazabilidadGG"
import { AgendaTareas } from "./screens/AgendaTareas"
import { ChecklistDocumentos } from "./screens/ChecklistDocumentos"
import { Metricas } from "./screens/Metricas"
import { AuditorHome } from "./screens/auditor/AuditorHome"
import { AuditorOrgDetalle } from "./screens/auditor/AuditorOrgDetalle"
import { AuditorNuevaAuditoria } from "./screens/auditor/AuditorNuevaAuditoria"
import { AuditorEjecucion } from "./screens/auditor/AuditorEjecucion"
import { AuditorNuevaInstalacion } from "./screens/auditor/AuditorNuevaInstalacion"
import { AuditorInstalacionDetalle } from "./screens/auditor/AuditorInstalacionDetalle"
import { AuditorNuevaAuditoriaEfimera } from "./screens/auditor/AuditorNuevaAuditoriaEfimera"
import { AuditorAgenda } from "./screens/auditor/AuditorAgenda"
import { AuditorModoAzzule } from "./screens/auditor/AuditorModoAzzule"
import { NuevaJornada } from "./screens/auditor/NuevaJornada"
import { EjecucionJornada } from "./screens/auditor/EjecucionJornada"
import { Sincronizacion } from "./screens/Sincronizacion"
import { RequireNomina } from "./components/RequireNomina"
import { NominaSemana } from "./screens/nomina/NominaSemana"
import { NominaTrabajadorSemana } from "./screens/nomina/NominaTrabajadorSemana"
import { NominaTrabajadores } from "./screens/nomina/NominaTrabajadores"
import { NominaTrabajadorDetalle } from "./screens/nomina/NominaTrabajadorDetalle"
import { NominaCatalogo } from "./screens/nomina/NominaCatalogo"
import { NominaHistorial } from "./screens/nomina/NominaHistorial"
import { MisVouchers } from "./screens/nomina/MisVouchers"
import { NominaMensual } from "./screens/nomina/NominaMensual"
import { NominaConfiguracion } from "./screens/nomina/NominaConfiguracion"
import { NominaOrgsAdmin } from "./screens/nomina/NominaOrgsAdmin"

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
    ErrorBoundary: RootError,
  },
  {
    path: "/registro",
    Component: Registro,
    ErrorBoundary: RootError,
  },
  {
    path: "/nfc/:token",
    Component: NfcEstacion,
    ErrorBoundary: RootError,
  },
  {
    path: "/restablecer-contrasena",
    Component: RestablecerContrasena,
    ErrorBoundary: RootError,
  },
  {
    path: "/",
    Component: RequireAuth,
    ErrorBoundary: RootError,
    children: [
      // Accesible sin org — para completar el alta después del signUp
      {
        path: "completar-organizacion",
        Component: CompletarOrganizacion,
      },
      // Resto de la app requiere org_id configurado
      {
        Component: RequireOrg,
        children: [
          {
            Component: Layout,
            children: [
              { index: true, Component: Home },
              {
                path: "auditor",
                Component: AuditorHome,
                children: [{ path: "instalacion/nueva", Component: AuditorNuevaInstalacion, handle: { ventana: true } }],
              },
              { path: "auditor/agenda", Component: AuditorAgenda },
              { path: "auditor/calendario", Component: RedirCalendario },
              {
                path: "auditor/org/:orgId",
                Component: AuditorOrgDetalle,
                children: [{ path: "nueva", Component: AuditorNuevaAuditoria, handle: { ventana: true } }],
              },
              { path: "auditor/auditoria/:auditoriaId", Component: AuditorEjecucion },
              { path: "auditor/auditoria/:auditoriaId/azzule", Component: AuditorModoAzzule },
              {
                path: "auditor/instalacion/:instalacionId",
                Component: AuditorInstalacionDetalle,
                children: [{ path: "nueva", Component: AuditorNuevaAuditoriaEfimera, handle: { ventana: true } }],
              },
              { path: "auditor/jornada/nueva", Component: NuevaJornada },
              { path: "auditor/jornada/:jornadaId", Component: EjecucionJornada },
              { path: "nueva-aplicacion", Component: NuevaAplicacion },
              { path: "inventario", Component: Inventario },
              { path: "historial", Component: BibliotecaHistorial },
              { path: "historial/:id", Component: DetalleAplicacion },
              { path: "perfil", Component: Perfil },
              { path: "sincronizacion", Component: Sincronizacion },
              { path: "perfil/mi-organizacion", Component: MiOrganizacion },
              { path: "equipo/actividad", Component: ActividadEquipo },
              { path: "metricas", Component: Metricas },
              { path: "mis-vouchers", Component: MisVouchers },
              { path: "admin/nomina-orgs", Component: NominaOrgsAdmin },
              {
                path: "nomina",
                Component: RequireNomina,
                children: [
                  { index: true, Component: NominaSemana },
                  { path: "semana/:trabajadorId", Component: NominaTrabajadorSemana },
                  { path: "trabajadores", Component: NominaTrabajadores },
                  { path: "trabajadores/:id", Component: NominaTrabajadorDetalle },
                  { path: "catalogo", Component: NominaCatalogo },
                  { path: "historial", Component: NominaHistorial },
                  { path: "mensual", Component: NominaMensual },
                  { path: "configuracion", Component: NominaConfiguracion },
                ],
              },
              { path: "inocuidad/auditorias-primusgfs", Component: AuditoriasPrimusGFS },
              { path: "inocuidad/auditorias-primusgfs/nueva", Component: NuevaAuditoriaPGFS },
              { path: "inocuidad/auditorias-primusgfs/:auditoriaId", Component: CapturaAuditoriaPGFS },
              {
                path: "inocuidad",
                Component: RequireModulo,
                ErrorBoundary: InocuidadError,
                children: [
                  { path: "botiquin", Component: BotiquinPrimerosAuxilios },
                  { path: "vidrio-plastico", Component: InspeccionVidrioPlastico },
                  { path: "fertilizacion", Component: RegistroFertilizacion },
                  { path: "perimetral", Component: InspeccionPerimetral },
                  { path: "cosecha", Component: RegistroCosechaLiberacion },
                  { path: "preoperacional", Component: InspeccionPreoperacionalCosecha },
                  { path: "limpieza-banos", Component: RegistroLimpiezaBanos },
                  { path: "incidencias", Component: ReporteIncidencias },
                  { path: "auditoria-saia", Component: AuditoriaSaia },
                  { path: "auditoria-granja", Component: AuditoriaGranja },
                  { path: "auditoria-cosecha", Component: AuditoriaCosecha },
                  { path: "bpm", Component: AuditoriaBPM },
                  { path: "haccp", Component: AuditoriaHACCP },
                  { path: "inspeccion-preoperacional", Component: InspeccionPreoperacionalCooler },
                  { path: "accidentes", Component: RegistroAccidentesLaborales },
                  { path: "monitoreo-plagas", Component: MonitoreoEstacionesPlagas },
                  { path: "muestras-laboratorio", Component: RegistroMuestrasLaboratorio },
                  { path: "verificacion-insumos", Component: VerificacionInsumos },
                  { path: "preparacion-cloro", Component: PreparacionCloro },
                  { path: "inventario-quimicos", Component: ControlInventarioQuimicos },
                  { path: "no-conformidades", Component: ResumenNoConformidades },
                  { path: "acciones-correctivas", Component: AccionesCorrectivas },
                  { path: "limpieza-banos-quimicos", Component: LimpiezaBanosQuimicos },
                  { path: "limpieza-aduana", Component: LimpiezaAduana },
                  { path: "limpieza-comedor", Component: LimpiezaComedor },
                  { path: "limpieza-oficinas", Component: LimpiezaOficinas },
                  { path: "limpieza-patios-azoteas", Component: LimpiezaPatiosAzoteas },
                  { path: "limpieza-recepcion", Component: LimpiezaRecepcion },
                  { path: "limpieza-preenfrio-conservador", Component: LimpiezaPreenfrio },
                  { path: "limpieza-almacen-empaque", Component: LimpiezaAlmacenEmpaque },
                  { path: "monitoreo-germicida", Component: MonitoreoGermicida },
                  { path: "limpieza-cisterna", Component: LimpiezaCisterna },
                  { path: "manifiesto-embarque", Component: ManifiestoEmbarque },
                  { path: "recepcion-fruta", Component: RecepcionFruta },
                  { path: "entradas-salidas-prefrio", Component: EntradasSalidasPreFrio },
                  { path: "temperaturas-conservador", Component: TemperaturasConservador },
                  { path: "material-empaque-movimientos", Component: MaterialEmpaqueMovimientos },
                  { path: "inspeccion-almacen-empaque", Component: InspeccionAlmacenEmpaque },
                  { path: "orden-mantenimiento", Component: OrdenMantenimiento },
                  { path: "mantenimiento-preventivo", Component: MantenimientoPreventivo },
                  { path: "rondines-vigilancia", Component: RondinesVigilancia },
                  { path: "registro-personal", Component: RegistroPersonal },
                  { path: "trazabilidad", Component: TrazabilidadProducto },
                  { path: "calibracion-bombas", Component: CalibracionBombas },
                  { path: "calibracion-equipos", Component: CalibracionEquipos },
                  { path: "calibracion-basculas", Component: CalibracionBasculas },
                  { path: "calibracion-volumetricos", Component: CalibracionVolumetricos },
                  { path: "consumo-energia", Component: ConsumoEnergia },
                  { path: "gestion-residuos", Component: GestionResiduos },
                  { path: "fuentes-agua", Component: FuentesAgua },
                  { path: "mip-preventivo", Component: MipPreventivo },
                  { path: "mip-observacion", Component: MipObservacion },
                  { path: "mip-intervencion", Component: MipIntervencion },
                  { path: "frecuencia-capacitacion", Component: FrecuenciaCapacitacion },
                  { path: "cronograma-capacitacion", Component: CronogramaCapacitacion },
                  { path: "uso-epp", Component: UsoEpp },
                  { path: "control-herramientas", Component: ControlHerramientas },
                  { path: "sanitizacion-cosecha", Component: SanitizacionCosecha },
                  { path: "productos-autorizados", Component: ProductosAutorizados },
                  { path: "tensiometros", Component: Tensiometros },
                  { path: "plan-suelo", Component: PlanSuelo },
                  { path: "fertilizacion-gg", Component: FertilizacionGG },
                  { path: "monitoreo-roedores", Component: MonitoreoRoedores },
                  { path: "verificacion-cosecha", Component: VerificacionCosecha },
                  { path: "limpieza-campo", Component: LimpiezaCampo },
                  { path: "verificacion-roedores", Component: VerificacionRoedores },
                  { path: "monitoreo-plagas-enfermedades", Component: MonitoreoPlaguasEnfermedades },
                  { path: "botiquin-gg", Component: BotiquinGG },
                  { path: "germicida-gg", Component: GermicidaGG },
                  { path: "almacen-empaque-gg", Component: AlmacenEmpaqueGG },
                  { path: "mantenimiento-equipos-gg", Component: MantenimientoEquiposGG },
                  { path: "empleados-gg", Component: EmpleadosGG },
                  { path: "trazabilidad-gg", Component: TrazabilidadGG },
                  { path: "agenda", Component: AgendaTareas },
                  { path: "checklist", Component: ChecklistDocumentos },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
