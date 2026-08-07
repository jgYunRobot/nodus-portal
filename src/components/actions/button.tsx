import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";

type ButtonTone = "primary" | "secondary" | "danger";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: ButtonTone;
}

export function Button({
  children,
  className,
  tone = "primary",
  ...props
}: ButtonProps) {
  const button_class_name = [styles.button, styles[tone], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={button_class_name} type="button" {...props}>
      {children}
    </button>
  );
}
