"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ThemeProviderProps {
  children: React.ReactNode;
  /** CSP nonce for the inline theme script next-themes injects pre-hydration. */
  nonce?: string;
}

export function ThemeProvider({ children, nonce }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
