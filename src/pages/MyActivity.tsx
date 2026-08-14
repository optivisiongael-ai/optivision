import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Mi Actividad has been merged into /ventas → redirect transparently
export default function MyActivity() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/ventas', { replace: true }); }, []);
  return null;
}
