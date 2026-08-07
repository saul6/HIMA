import { createBrowserRouter, useRouteError } from "react-router";

function InocuidadError() {
  const err = useRouteError() as Error | null
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 gap-4">
      <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text)' }}>
        {err?.message ?? 'Error inesperado en el módulo.'}
      </p>
      <button
        onClick={() => window.location.assign('/')}
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
import { PreparacionCloro } from "./screens/PreparacionCloro"
import { ControlInventarioQuimicos } from "./screens/ControlInventarioQuimicos";
import { ResumenNoConformidades } from "./screens/ResumenNoConformidades";
import { AccionesCorrectivas } from "./screens/AccionesCorrectivas";
import { RequireModulo } from "./components/RequireModulo";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/registro",
    Component: Registro,
  },
  {
    path: "/",
    Component: RequireAuth,
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
              { path: "nueva-aplicacion", Component: NuevaAplicacion },
              { path: "inventario", Component: Inventario },
              { path: "historial", Component: BibliotecaHistorial },
              { path: "historial/:id", Component: DetalleAplicacion },
              { path: "perfil", Component: Perfil },
              { path: "perfil/mi-organizacion", Component: MiOrganizacion },
              { path: "equipo/actividad", Component: ActividadEquipo },
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
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
