import { useEffect, useMemo, useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { useCalendar, useTasks } from "../stores";
import { dateKey, localDate } from "../lib/date";
import { tap } from "../lib/haptics";
import {
  calendarBounds,
  clampCalendarDate,
  canMoveMonth,
} from "../lib/calendarBounds";
export function MonthCalendar() {
  const selected = useCalendar((s) => s.selected);
  const select = useCalendar((s) => s.select);
  const tasks = useTasks((s) => s.tasks);
  const { min, max } = calendarBounds();
  const safeSelected = clampCalendarDate(selected);
  const [month, setMonth] = useState(safeSelected.slice(0, 7));
  useEffect(() => {
    setMonth(safeSelected.slice(0, 7));
    if (selected !== safeSelected) select(safeSelected);
  }, [safeSelected, selected, select]);
  const dates = useMemo(() => new Set(tasks.map((t) => t.date)), [tasks]);
  return (
    <View style={styles.wrap}>
      <Calendar
        key={safeSelected.slice(0, 7)}
        current={safeSelected}
        minDate={min}
        maxDate={max}
        disableAllTouchEventsForDisabledDays
        disableArrowLeft={!canMoveMonth(month, -1)}
        disableArrowRight={!canMoveMonth(month, 1)}
        onMonthChange={(date: DateData) =>
          setMonth(date.dateString.slice(0, 7))
        }
        onPressArrowLeft={(subtract, date) => {
          if (date && canMoveMonth(date.toString("yyyy-MM"), -1)) subtract();
        }}
        onPressArrowRight={(add, date) => {
          if (date && canMoveMonth(date.toString("yyyy-MM"), 1)) add();
        }}
        firstDay={1}
        enableSwipeMonths
        hideExtraDays
        onDayPress={(d: DateData) => {
          tap();
          select(d.dateString);
        }}
        renderHeader={(date: any) => (
          <View style={styles.month}>
            <Text style={styles.monthName}>{date.toString("MMMM")}</Text>
            <Text style={styles.year}>{date.toString("yyyy")}</Text>
          </View>
        )}
        renderArrow={(direction) => (
          <Ionicons
            name={direction === "left" ? "chevron-back" : "chevron-forward"}
            size={17}
            color={
              canMoveMonth(month, direction === "left" ? -1 : 1)
                ? "#777"
                : "#ddd"
            }
          />
        )}
        theme={
          {
            calendarBackground: "#fff",
            textSectionTitleColor: "#999",
            textDayHeaderFontSize: 11,
            textDayHeaderFontWeight: "500",
            arrowColor: "#777",
            "stylesheet.calendar.header": {
              header: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              },
              week: {
                marginTop: 0,
                flexDirection: "row",
                justifyContent: "space-around",
                marginBottom: 8,
              },
            },
          } as any
        }
        dayComponent={({ date, state }: any) => {
          const active = date.dateString === selected;
          const disabled = date.dateString < min || date.dateString > max;
          const today = date.dateString === dateKey();
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={localDate(date.dateString).toDateString()}
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => {
                tap();
                select(date.dateString);
              }}
              style={styles.dayTarget}
            >
              <View style={[styles.day, active && styles.selected]}>
                <Text
                  style={[
                    styles.number,
                    state === "disabled" && { color: "#ccc" },
                    today && { fontWeight: "700" },
                    active && { color: "#fff" },
                  ]}
                >
                  {date.day}
                </Text>
              </View>
              <View
                style={[
                  styles.dot,
                  {
                    opacity: dates.has(date.dateString) ? 1 : 0,
                    backgroundColor: active ? "#111" : "#b8b8b8",
                  },
                ]}
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 17, paddingBottom: 23 },
  month: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  monthName: { fontSize: 27, fontWeight: "600", letterSpacing: -1 },
  year: { fontSize: 25, color: "#aaa", fontWeight: "300", letterSpacing: -0.7 },
  dayTarget: { width: 42, height: 44, alignItems: "center" },
  day: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  selected: { backgroundColor: "#181818" },
  number: { fontSize: 14, color: "#333" },
  dot: { width: 3, height: 3, borderRadius: 2, marginTop: 3 },
});
