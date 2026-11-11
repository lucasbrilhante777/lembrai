// Conversão entre o que o dono digita ("35,00") e o que a API guarda (3500 centavos).
// Ver o modelo de dados no README: dinheiro em centavos evita erro de arredondamento.

/** "35" | "35,5" | "35,50" | "R$ 1.234,56" -> centavos. Retorna null se não for um valor válido. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 3500 -> "35,00" (para preencher o campo ao editar) */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
