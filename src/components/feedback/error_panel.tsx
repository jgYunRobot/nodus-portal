import type { ReactNode } from "react";
import styles from "./error_panel.module.css";
interface ErrorPanelProps {
  action?: ReactNode;
  message: string;
  title: string;
}
export function ErrorPanel({ action, message, title }: ErrorPanelProps) {
  return (
    <section className={styles.panel} role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
