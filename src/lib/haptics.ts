/** Kurzes haptisches Feedback (Begonnen/Fertig/Checkliste/Schicht), wo unterstützt */
export function tap() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  } catch {
    /* nicht unterstützt */
  }
}
