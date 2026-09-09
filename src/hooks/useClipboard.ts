import { useEffect, useRef, useState } from 'react';

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string): Promise<boolean> => {
    setError(''); setCopied(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      setError('O navegador não permitiu copiar o link. Tente novamente ou copie o endereço manualmente.');
      return false;
    }
  };
  return { copied, error, copy };
}
