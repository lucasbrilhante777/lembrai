// Erro "esperado" da aplicação: algo que o cliente da API fez de errado
// ou um estado de negócio (ex.: horário ocupado). Carrega o status HTTP certo.
export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}
