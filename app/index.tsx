import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../components/Header";
import { MonthCalendar } from "../components/MonthCalendar";
import { TaskList } from "../components/TaskList";
import { FloatingPlus } from "../components/FloatingPlus";
import { AIChatModal } from "../components/AIChatModal";
import { TaskDetails } from "../components/TaskDetails";
import { Task } from "../lib/types";
export default function Home() {
  const [chat, setChat] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <View className="flex-1 bg-neutral-50">
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 540,
          alignSelf: "center",
          backgroundColor: "#fff",
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130 }}
        >
          <Header />
          <MonthCalendar />
          <TaskList onTask={setTask} />
        </ScrollView>
        <FloatingPlus
          onPress={() => {
            setDraft("");
            setChat(true);
          }}
        />
        <TaskDetails
          task={task}
          onClose={() => setTask(null)}
          onFeedback={(text) => {
            setTask(null);
            setDraft(text);
            setChat(true);
          }}
        />
        <AIChatModal
          visible={chat}
          onClose={() => setChat(false)}
          initialText={draft}
        />
      </SafeAreaView>
    </View>
  );
}
