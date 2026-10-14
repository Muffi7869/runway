import { ThemeControl } from "../../../components/theme-control";
import styles from "./settings.module.css";

export function AppearanceSection() {
  return <section className={`${styles.card} ${styles.appearance}`}>
    <div><h2>Appearance</h2><p className={styles.hint}>Choose how Runway looks on this device.</p></div>
    <ThemeControl />
  </section>;
}
