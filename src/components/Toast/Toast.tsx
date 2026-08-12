"use client";

import React, { useCallback, useRef, useState } from "react";
import styles from "./Toast.module.css";

export interface ToastHandle {
  show: (message: string) => void;
}

export const ToastContext = React.createContext<ToastHandle>({
  show: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    setText(message);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.toast} data-show={visible ? "true" : "false"}>
        {text}
      </div>
    </ToastContext.Provider>
  );
}
