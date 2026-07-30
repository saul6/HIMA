import { createBrowserRouter } from "react-router";
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
import { RequireModulo } from "./components/RequireModulo";
import TestSupabase from "./screens/TestSupabase";

export const router = createBrowserRouter([
  {
    path: "/test",
    Component: TestSupabase,
  },
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
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
