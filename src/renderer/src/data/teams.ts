import type { Team } from '../stores/campeonato'

export const teams: Team[] = [
  { id: 'isptec', name: 'ISPTEC', institution: 'Instituto Politécnico', category: 'universitario' },
  { id: 'uan', name: 'UAN', institution: 'Universidade Agostinho Neto', category: 'universitario' },
  { id: 'unia', name: 'UNIA', institution: 'Universidade Independente de Angola', category: 'universitario' },
  { id: 'ipg', name: 'IPG', institution: 'Instituto Politécnico da Gabela', category: 'universitario' },
  { id: 'metropolitana', name: 'U. Metropolitana', institution: 'Universidade Metropolitana de Angola', category: 'universitario' },
  { id: 'piaget', name: 'Jean Piaget', institution: 'Universidade Jean Piaget de Angola', category: 'universitario' },
  { id: 'lusiada', name: 'Lusíada', institution: 'Universidade Lusíada de Angola', category: 'universitario' },
  { id: 'katyavala', name: 'Katyavala Bwila', institution: 'Universidade Katyavala Bwila', category: 'universitario' },
  { id: 'oilmasters', name: 'Oil Masters', institution: 'Colégio Técnico A', category: 'ensino_medio' },
  { id: 'angolateam', name: 'Angola Team', institution: 'Colégio Técnico B', category: 'ensino_medio' },
  { id: 'colegioc', name: 'Colégio C', institution: 'Colégio Técnico C', category: 'ensino_medio' },
  { id: 'colegiod', name: 'Colégio D', institution: 'Colégio Técnico D', category: 'ensino_medio' },
  { id: 'exib-a', name: 'Equipa Demo A', institution: 'Convidados', category: 'exibicao' },
  { id: 'exib-b', name: 'Equipa Demo B', institution: 'Convidados', category: 'exibicao' }
]
