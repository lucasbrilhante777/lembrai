import { useEffect, useState } from "react";

/**
 * O "agora", atualizado a cada minuto.
 * Chamar `new Date()` direto na renderização é impuro (cada render daria um valor diferente).
 * Aqui o valor fica guardado em estado e muda num ritmo previsível. Na agenda, isso faz o botão
 * "Cancelar" virar "Concluído / Faltou" sozinho quando chega a hora do atendimento.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
