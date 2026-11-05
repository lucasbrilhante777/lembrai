import type { AuthPayload } from "../lib/token.js";

// Ensina o TypeScript que o middleware de autenticação adiciona `req.auth`.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export {};
