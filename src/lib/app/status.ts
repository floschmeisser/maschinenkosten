export type StatusTone = "good" | "warning" | "danger" | "neutral";

export function getMaintenanceStatus(nextServiceHours: number, currentHours: number): StatusTone {
  const remainingHours = nextServiceHours - currentHours;

  if (remainingHours <= 0) {
    return "danger";
  }

  if (remainingHours <= 25) {
    return "warning";
  }

  return "good";
}

export function getStatusLabel(status: StatusTone): string {
  const labels: Record<StatusTone, string> = {
    good: "In Ordnung",
    warning: "Bald fällig",
    danger: "Fällig",
    neutral: "Offen"
  };

  return labels[status];
}
