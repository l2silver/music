import { MusicGame } from "@/components/MusicGame";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <MusicGame />
    </div>
  );
}
