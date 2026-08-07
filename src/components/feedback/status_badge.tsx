import styles from "./status_badge.module.css";
type StatusTone = "success" | "warning" | "danger" | "neutral";
interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>;
}
