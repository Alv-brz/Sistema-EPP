export const eppLabels: Record<string, string> = {
  casco: 'Casco',
  chaleco: 'Chaleco',
  mascarilla: 'Mascarilla',
  botas: 'Botas',
  guantes: 'Guantes',
  lentes: 'Lentes',
};

export const objectLabels: Record<string, string> = {
  persona: 'Persona',
  vehiculo: 'Vehículo',
  maquinaria: 'Maquinaria',
  cono_seguridad: 'Cono de Seguridad',
};

export function eppLabel(value: string): string {
  return eppLabels[value] ?? value.replace(/_/g, ' ');
}

export function objectLabel(value: string): string {
  return objectLabels[value] ?? value.replace(/_/g, ' ');
}

export function formatEppList(values: string[]): string {
  return values.map(eppLabel).join(', ');
}
