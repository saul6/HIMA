import {
  SprayCan, Boxes, Library, BriefcaseMedical, Wine, Sprout, Radar, Wheat,
  ClipboardCheck, Droplets, Camera, ClipboardList, Users, Shield, ShieldCheck, Eye,
  Package, FileCheck, Factory, Bandage, Bug, FlaskConical, ListChecks, TestTubes,
  Warehouse, UtensilsCrossed, Building2, LayoutGrid, type LucideIcon,
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
  'layout-grid': LayoutGrid,
}

export function resolverIcono(nombre: string): LucideIcon {
  return ICONOS[nombre] ?? LayoutGrid
}
