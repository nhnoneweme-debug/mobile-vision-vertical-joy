import { MonthGlance } from "@/components/home/MonthGlance";

export function AgendaPanel({
  marked,
  activitiesByWeekday,
}: {
  marked: number[];
  activitiesByWeekday: Record<number, string[]>;
}) {
  return <MonthGlance marked={marked} activitiesByWeekday={activitiesByWeekday} />;
}
