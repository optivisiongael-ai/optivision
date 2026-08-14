import { useEffect, useState } from 'react';
import { supabase } from './supabase/client';

export type CatalogType = 'PRODUCT_CATEGORY' | 'FRAME_TYPE' | 'CRYSTAL_TYPE';

export interface CatalogOption {
  id: string;
  type: CatalogType;
  value: string;
  label: string;
  color?: string;
  sort_order: number;
  active: boolean;
}

export function useCatalog(type: CatalogType) {
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('catalog_options')
      .select('*')
      .eq('type', type)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    setOptions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [type]);

  return { options, loading, refetch: fetch };
}

/** Fetch multiple catalog types in one shot */
export async function fetchCatalogByTypes(types: CatalogType[]): Promise<Record<CatalogType, CatalogOption[]>> {
  const { data } = await supabase
    .from('catalog_options')
    .select('*')
    .in('type', types)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const result = {} as Record<CatalogType, CatalogOption[]>;
  for (const t of types) result[t] = [];
  for (const row of data || []) {
    result[row.type as CatalogType]?.push(row);
  }
  return result;
}
