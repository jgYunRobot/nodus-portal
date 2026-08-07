import styles from "./skeleton.module.css";
export function Skeleton({ label }: { label: string }) {
  return <div aria-label={label} className={styles.skeleton} role="status" />;
}
