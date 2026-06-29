import { useCallback, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState('');

  const show = useCallback((msg: string) => setMessage(msg), []);
  const dismiss = useCallback(() => setMessage(''), []);

  return { message, show, dismiss };
}
