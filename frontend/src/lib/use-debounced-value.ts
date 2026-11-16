import { useEffect, useState } from "react";

/**
 * Devolve o valor só depois que ele parar de mudar por `delayMs`.
 * Na busca de clientes: digitar "maria" não faz 5 chamadas à API (m, ma, mar...), só uma, quando a pessoa para.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id); // digitou de novo antes do prazo: cancela e recomeça a contar
  }, [value, delayMs]);
  return debounced;
}
