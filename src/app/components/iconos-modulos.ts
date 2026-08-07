import {
  SprayCan, Boxes, Library, BriefcaseMedical, Wine, Sprout, Radar, Wheat,
  ClipboardCheck, Droplet, Droplets, Camera, ClipboardList, Users, Shield, ShieldCheck, Eye,
  Package, FileCheck, Factory, Bandage, Bug, FlaskConical, ListChecks, TestTubes,
  Warehouse, UtensilsCrossed, Building2, Trees, PackageOpen, Snowflake, Truck, ArrowLeftRight, LayoutGrid, type LucideIcon,
} from 'lucide-react'

const ICONOS: Record<string, LucideIcon> = {
  'spray-can': SprayCan,
  'boxes': Boxes,
  'library': Library,
  'briefcase-medical': BriefcaseMedical,
  'wine': Wine,
  'sprout': Sprout,
  'radar': Radar,
  'wheat': Wheat,
  'clipboard-check': ClipboardCheck,
  'droplet': Droplet,
  'droplet-half-2': Droplet,
  'droplets': Droplets,
  'camera': Camera,
  'clipboard-list': ClipboardList,
  'users': Users,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'eye': Eye,
  'package': Package,
  'file-check': FileCheck,
  'factory': Factory,
  'bandage': Bandage,
  'bug': Bug,
  'flask-conical': FlaskConical,
  'list-checks': ListChecks,
  'test-tubes': TestTubes,
  'warehouse': Warehouse,
  'utensils-crossed': UtensilsCrossed,
  'building-2': Building2,
  'trees': Trees,
  'package-open': PackageOpen,
  'package-import': PackageOpen,
  'snowflake': Snowflake,
  'truck': Truck,
  'arrow-left-right': ArrowLeftRight,
  'layout-grid': LayoutGrid,
}

export function resolverIcono(nombre: string): LucideIcon {
  return ICONOS[nombre] ?? LayoutGrid
}
