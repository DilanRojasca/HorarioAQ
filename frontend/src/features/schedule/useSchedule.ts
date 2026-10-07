import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import type { WeeklyResult } from './types';

export function useSchedule() {
  const [data, setData] = useState<WeeklyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get<WeeklyResult>('/schedule/me')
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  return { data, error, loading };
}
