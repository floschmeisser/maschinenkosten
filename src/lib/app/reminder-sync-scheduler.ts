export function scheduleReminderSync(): void {
  void import("./reminder-sync")
    .then(({ syncRemindersFromCurrentData }) => syncRemindersFromCurrentData())
    .catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("Reminder-Sync fehlgeschlagen.", error);
      }
    });
}
