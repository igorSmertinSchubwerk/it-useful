import { useQuery } from '@tanstack/react-query'
import { createElementsApi } from '../../api/elements'

export const elementsApi = createElementsApi()
export const elementKeys = {
  all: ['elements'] as const,
  list: ['elements', 'list'] as const,
  detail: (id: string) => ['elements', 'detail', id] as const,
}
export function useElements() {
  return useQuery({
    queryKey: elementKeys.list,
    queryFn: ({ signal }) => elementsApi.list(signal),
    retry: false,
    staleTime: 30_000,
  })
}

export function useElement(id: string) {
  return useQuery({
    queryKey: elementKeys.detail(id),
    queryFn: ({ signal }) => elementsApi.get(id, signal),
    retry: false,
    staleTime: 30_000,
  })
}
