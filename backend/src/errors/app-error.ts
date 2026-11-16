// Erro "esperado" da aplicação: algo que o cliente da API fez de errado
// ou um estado de negócio (ex.: horário ocupado). Carrega o status HTTP certo.
// O `code` (opcional) deixa o front diferenciar erros com o mesmo status:
// dois 409 diferentes pedem reações diferentes na tela.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
