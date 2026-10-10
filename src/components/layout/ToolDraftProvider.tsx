"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type ToolDraftContextValue = {
  scannerDraft: string;
  setScannerDraft: Dispatch<SetStateAction<string>>;
};

const ToolDraftContext = createContext<ToolDraftContextValue | null>(null);

export function ToolDraftProvider({ children }: { children: ReactNode }) {
  const [scannerDraft, setScannerDraft] = useState("");
  const value = useMemo(
    () => ({ scannerDraft, setScannerDraft }),
    [scannerDraft],
  );

  return (
    <ToolDraftContext.Provider value={value}>
      {children}
    </ToolDraftContext.Provider>
  );
}

export function useToolDraft() {
  const context = useContext(ToolDraftContext);
  if (!context)
    throw new Error("useToolDraft must be used within ToolDraftProvider");
  return context;
}
