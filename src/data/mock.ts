/**
 * mock.ts — Datos de ejemplo para desarrollo sin conexión a Supabase.
 * Cuando se integre Supabase, estas constantes se reemplazarán por llamadas
 * a la base de datos manteniendo las mismas interfaces.
 */

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export interface Productor {
  id: string;
  nombre: string;
  rancho: string;
  cultivo: string;
  asesorTecnico: string;
  responsableInocuidad: string;
}

export interface HuertoOption {
  value: string;
  label: string;
  code: string;
  /** Cultivo principal del huerto — se auto-llena en el formulario */
  cultivo: string;
  productorId: string;
}

export interface ProductoCatalogo {
  id: string;
  nombreComercial: string;
  ingredienteActivo: string;
  /** Número de registro RSCO/COFEPRIS */
  rsco: string;
  categoria: "Fungicidas" | "Insecticidas" | "Adherentes" | "Herbicidas";
  diasCosecha: number;
  reentradaHrs: number;
  dosisHa: number;
  dosis200L: number;
  unidad: "kg" | "L";
}

export interface MovimientoInventario {
  date: string;
  type: "Entrada" | "Salida";
  quantity: number;
  balance: number;
}

export interface ItemInventario {
  id: string;
  commercialName: string;
  activeIngredient: string;
  category: string;
  stock: number;
  unit: "kg" | "L";
  /** available = stock normal · low = stock bajo · empty = agotado */
  status: "available" | "low" | "empty";
  lastMovement: string;
  movements: MovimientoInventario[];
}

export interface Aplicacion {
  id: string;
  date: string;
  product: string;
  pest: string;
  rancho: string;
  status: "Completado" | "Pendiente";
}

export interface MetricaDashboard {
  label: string;
  value: string;
}

// -------------------------------------------------------
// Operario actualmente logueado (sesión mock)
// -------------------------------------------------------

export const operarioActual: Productor = {
  id: "1",
  nombre: "Carlos Alvarez Naranjo",
  rancho: "Rancho El Solar",
  cultivo: "Zarzamora",
  asesorTecnico: "Luis Ignacio Rosales Guerrero",
  responsableInocuidad: "Director Hima",
};

// -------------------------------------------------------
// Productores registrados
// -------------------------------------------------------

export const productores: Productor[] = [
  {
    id: "1",
    nombre: "Carlos Alvarez Naranjo",
    rancho: "Rancho El Solar",
    cultivo: "Zarzamora",
    asesorTecnico: "Luis Ignacio Rosales Guerrero",
    responsableInocuidad: "Director Hima",
  },
  {
    id: "2",
    nombre: "Alejandro Lucatero Sánchez",
    rancho: "Rancho Aranon",
    cultivo: "Frambuesa",
    asesorTecnico: "Luis Ignacio Rosales Guerrero",
    responsableInocuidad: "Director Hima",
  },
];

// -------------------------------------------------------
// Huertos / Ranchos
// -------------------------------------------------------

export const huertos: HuertoOption[] = [
  {
    value: "el-solar",
    label: "Rancho El Solar",
    code: "RS-001",
    cultivo: "Zarzamora",
    productorId: "1",
  },
  {
    value: "el-solar-fresa",
    label: "El Solar — Sector Fresa",
    code: "RS-002",
    cultivo: "Fresa",
    productorId: "1",
  },
  {
    value: "aranon",
    label: "Rancho Aranon",
    code: "RA-001",
    cultivo: "Frambuesa",
    productorId: "2",
  },
];

// -------------------------------------------------------
// Catálogo de productos agroquímicos
// Incluye RSCO/COFEPRIS para auto-llenado en el formulario M1
// -------------------------------------------------------

export const catalogoProductos: ProductoCatalogo[] = [
  {
    id: "1",
    nombreComercial: "Mancozeb 80%",
    ingredienteActivo: "Mancozeb",
    rsco: "RSCO-0045-2019",
    categoria: "Fungicidas",
    diasCosecha: 7,
    reentradaHrs: 24,
    dosisHa: 2.5,
    dosis200L: 0.5,
    unidad: "kg",
  },
  {
    id: "2",
    nombreComercial: "Lambda-cyhalotrin 5%",
    ingredienteActivo: "Lambda-cihalotrina",
    rsco: "RSCO-0123-2020",
    categoria: "Insecticidas",
    diasCosecha: 14,
    reentradaHrs: 48,
    dosisHa: 0.25,
    dosis200L: 0.05,
    unidad: "L",
  },
  {
    id: "3",
    nombreComercial: "Azoxystrobin 25%",
    ingredienteActivo: "Azoxistrobina",
    rsco: "RSCO-0089-2021",
    categoria: "Fungicidas",
    diasCosecha: 1,
    reentradaHrs: 4,
    dosisHa: 1.0,
    dosis200L: 0.2,
    unidad: "L",
  },
  {
    id: "4",
    nombreComercial: "Imidacloprid 35%",
    ingredienteActivo: "Imidacloprid",
    rsco: "RSCO-0156-2018",
    categoria: "Insecticidas",
    diasCosecha: 21,
    reentradaHrs: 72,
    dosisHa: 0.5,
    dosis200L: 0.1,
    unidad: "L",
  },
  {
    id: "5",
    nombreComercial: "Chlorothalonil 72%",
    ingredienteActivo: "Clorotalonil",
    rsco: "RSCO-0078-2017",
    categoria: "Fungicidas",
    diasCosecha: 7,
    reentradaHrs: 24,
    dosisHa: 2.0,
    dosis200L: 0.4,
    unidad: "kg",
  },
  {
    id: "6",
    nombreComercial: "Spinosad 48%",
    ingredienteActivo: "Espinosad",
    rsco: "RSCO-0445-2022",
    categoria: "Insecticidas",
    diasCosecha: 3,
    reentradaHrs: 4,
    dosisHa: 0.3,
    dosis200L: 0.06,
    unidad: "L",
  },
];

// -------------------------------------------------------
// Inventario de plaguicidas — Rancho El Solar
// -------------------------------------------------------

export const inventario: ItemInventario[] = [
  {
    id: "1",
    commercialName: "Mancozeb 80%",
    activeIngredient: "Mancozeb",
    category: "Fungicidas",
    stock: 45.5,
    unit: "kg",
    status: "available",
    lastMovement: "2026-03-15",
    movements: [
      { date: "2026-03-15", type: "Salida", quantity: -5.5, balance: 45.5 },
      { date: "2026-03-01", type: "Entrada", quantity: 50, balance: 51 },
    ],
  },
  {
    id: "2",
    commercialName: "Lambda-cyhalotrin 5%",
    activeIngredient: "Lambda-cihalotrina",
    category: "Insecticidas",
    stock: 12.2,
    unit: "L",
    status: "low",
    lastMovement: "2026-03-14",
    movements: [
      { date: "2026-03-14", type: "Salida", quantity: -3.5, balance: 12.2 },
      { date: "2026-02-20", type: "Entrada", quantity: 15, balance: 15.7 },
    ],
  },
  {
    id: "3",
    commercialName: "Azoxystrobin 25%",
    activeIngredient: "Azoxistrobina",
    category: "Fungicidas",
    stock: 0,
    unit: "L",
    status: "empty",
    lastMovement: "2026-03-12",
    movements: [
      { date: "2026-03-12", type: "Salida", quantity: -4, balance: 0 },
      { date: "2026-02-15", type: "Entrada", quantity: 20, balance: 4 },
    ],
  },
  {
    id: "4",
    commercialName: "Imidacloprid 35%",
    activeIngredient: "Imidacloprid",
    category: "Insecticidas",
    stock: 28,
    unit: "L",
    status: "available",
    lastMovement: "2026-03-10",
    movements: [
      { date: "2026-03-10", type: "Salida", quantity: -2, balance: 28 },
      { date: "2026-02-28", type: "Entrada", quantity: 30, balance: 30 },
    ],
  },
  {
    id: "5",
    commercialName: "Chlorothalonil 72%",
    activeIngredient: "Clorotalonil",
    category: "Fungicidas",
    stock: 8,
    unit: "kg",
    status: "low",
    lastMovement: "2026-03-08",
    movements: [
      { date: "2026-03-08", type: "Salida", quantity: -7, balance: 8 },
      { date: "2026-02-10", type: "Entrada", quantity: 15, balance: 15 },
    ],
  },
];

// -------------------------------------------------------
// Aplicaciones registradas recientes — Rancho El Solar
// -------------------------------------------------------

export const aplicaciones: Aplicacion[] = [
  {
    id: "1",
    date: "16 Mar",
    product: "Mancozeb 80%",
    pest: "Botrytis cinerea",
    rancho: "Rancho El Solar",
    status: "Completado",
  },
  {
    id: "2",
    date: "14 Mar",
    product: "Lambda-cyhalotrin",
    pest: "Trips",
    rancho: "Rancho El Solar",
    status: "Completado",
  },
  {
    id: "3",
    date: "12 Mar",
    product: "Azoxystrobin",
    pest: "Oidio",
    rancho: "Rancho El Solar",
    status: "Completado",
  },
  {
    id: "4",
    date: "10 Mar",
    product: "Imidacloprid",
    pest: "Pulgón",
    rancho: "Rancho El Solar",
    status: "Pendiente",
  },
];

// -------------------------------------------------------
// Métricas del dashboard — calculadas sobre los datos del mes
// -------------------------------------------------------

export const metricas: MetricaDashboard[] = [
  { label: "Total aplicaciones este mes", value: "12" },
  { label: "Productos distintos usados", value: "8" },
  { label: "Días desde última aplicación", value: "2" },
  { label: "Superficie activa (ha)", value: "45.5" },
];
