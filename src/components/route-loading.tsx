import styles from "./route-loading.module.css";

export function RouteLoading() {
  return (
    <main aria-busy="true" aria-label="Loading content" className={styles.page}>
      <div className={`${styles.line} ${styles.heading}`} />
      <div className={`${styles.line} ${styles.subheading}`} />
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={`${styles.line} ${styles.cardTitle}`} />
          <div className={styles.line} />
          <div className={`${styles.line} ${styles.short}`} />
        </div>
        <div className={styles.card}>
          <div className={`${styles.line} ${styles.cardTitle}`} />
          <div className={styles.line} />
          <div className={`${styles.line} ${styles.short}`} />
        </div>
      </div>
    </main>
  );
}
