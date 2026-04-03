import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./screens/Home";
import { NuevaAplicacion } from "./screens/NuevaAplicacion";
import { Inventario } from "./screens/Inventario";
import { Historial } from "./screens/Historial";
import { Perfil } from "./screens/Perfil";
import { DetalleAplicacion } from "./screens/DetalleAplicacion";
import { BotiquinPrimerosAuxilios } from "./screens/BotiquinPrimerosAuxilios";
import { InspeccionVidrioPlastico } from "./screens/InspeccionVidrioPlastico";
import { RegistroFertilizacion } from "./screens/RegistroFertilizacion";
import { InspeccionPerimetral } from "./screens/InspeccionPerimetral";
import { RegistroCosechaLiberacion } from "./screens/RegistroCosechaLiberacion";
import { InspeccionPreoperacionalCosecha } from "./screens/InspeccionPreoperacionalCosecha";
import { RegistroLimpiezaBanos } from "./screens/RegistroLimpiezaBanos";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "nueva-aplicacion", Component: NuevaAplicacion },
      { path: "inventario", Component: Inventario },
      { path: "historial", Component: Historial },
      { path: "historial/:id", Component: DetalleAplicacion },
      { path: "perfil", Component: Perfil },
      { path: "inocuidad/botiquin", Component: BotiquinPrimerosAuxilios },
      { path: "inocuidad/vidrio-plastico", Component: InspeccionVidrioPlastico },
      { path: "inocuidad/fertilizacion", Component: RegistroFertilizacion },
      { path: "inocuidad/perimetral", Component: InspeccionPerimetral },
      { path: "inocuidad/cosecha", Component: RegistroCosechaLiberacion },
      { path: "inocuidad/preoperacional", Component: InspeccionPreoperacionalCosecha },
      { path: "inocuidad/limpieza-banos", Component: RegistroLimpiezaBanos },
    ],
  },
]);
