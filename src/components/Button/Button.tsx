import React from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "dark" | "soft" | "outline" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? styles.primary
      : variant === "dark"
        ? styles.dark
        : variant === "soft"
          ? styles.soft
          : variant === "outline"
            ? styles.outline
            : styles.danger;

  return (
    <button className={`${styles.btn} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
