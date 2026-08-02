import styles from "./FlowChart.module.css";

/**
 * Simple readable flowchart.
 * steps: string[] | { label: string, note?: string }[]
 * direction: "horizontal" | "vertical"
 */
export default function FlowChart({ title, steps = [], direction = "horizontal" }) {
  const items = steps.map((s) => (typeof s === "string" ? { label: s } : s));

  return (
    <figure className={`${styles.wrap} ${direction === "vertical" ? styles.vertical : ""}`}>
      {title ? <figcaption className={styles.caption}>{title}</figcaption> : null}
      <ol className={styles.track}>
        {items.map((step, i) => (
          <li key={`${step.label}-${i}`} className={styles.step}>
            <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
            <div className={styles.card}>
              <strong>{step.label}</strong>
              {step.note ? <p>{step.note}</p> : null}
            </div>
            {i < items.length - 1 ? <span className={styles.arrow} aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function FlowBranches({ title, branches = [] }) {
  return (
    <figure className={styles.wrap}>
      {title ? <figcaption className={styles.caption}>{title}</figcaption> : null}
      <div className={styles.branches}>
        {branches.map((b) => (
          <div key={b.title} className={styles.branch}>
            <p className={styles.branchTitle}>{b.title}</p>
            <ol className={styles.branchList}>
              {b.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </figure>
  );
}
