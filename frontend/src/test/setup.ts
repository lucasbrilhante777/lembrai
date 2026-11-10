import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { takeUnmatchedRoutes } from "./mock-api.tsx";

// Desmonta os componentes e desfaz os mocks entre um teste e outro.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  const unmatched = takeUnmatchedRoutes();
  if (unmatched.length > 0) {
    throw new Error(`A tela chamou rotas que o teste não simulou: ${[...new Set(unmatched)].join(", ")}`);
  }
});
