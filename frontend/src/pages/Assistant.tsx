import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFarmData } from "@/hooks/useFarm";
import { cn } from "@/lib/utils";
import { requestAssistant } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

const COPY = {
  en: {
    placeholder: "Ask about pests, irrigation, fertilizer, market timing…",
    empty: "Ask me anything about your farm.",
    suggestions: [
      "My rice leaves are turning yellow. What should I do?",
      "How much water does maize need this week?",
      "Best organic fertilizer for sandy soil?",
    ],
    send: "Send",
  },
  ta: {
    placeholder: "பூச்சி, நீர்ப்பாசனம், உரம் பற்றி கேளுங்கள்…",
    empty: "உங்கள் பண்ணை பற்றி எதையும் கேளுங்கள்.",
    suggestions: [
      "என் நெல் இலைகள் மஞ்சளாகின்றன. என்ன செய்வது?",
      "இந்த வாரம் மக்காச்சோளத்திற்கு எவ்வளவு நீர் தேவை?",
      "மணல் மண்ணுக்கு சிறந்த இயற்கை உரம் எது?",
    ],
    send: "அனுப்பு",
  },
};

export default function AssistantPage() {
  const { data } = useFarmData();
  const [lang, setLang] = useState<"en" | "ta">("en");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const copy = COPY[lang];

  useEffect(() => {
    if (data?.profile?.language === "ta") setLang("ta");
  }, [data?.profile?.language]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading, lang]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const json = await requestAssistant({
        messages: next,
        language: lang,
        context: data?.farm
          ? `${data.farm.name}, ${data.farm.location}, ${data.farm.total_area} acres, soil ${data.farm.soil_type}, crop ${data.farm.current_crop}, water ${data.farm.water_source}`
          : "no farm profile yet",
      });
      if (!json.reply) throw new Error(json.error ?? "Assistant unavailable");
      setMessages([...next, { role: "assistant", content: json.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant unavailable");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="AI Farming Assistant" subtitle="English & தமிழ் support">
      <Card className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" /> FarmSphere Assistant
          </span>
          <Tabs value={lang} onValueChange={(v) => setLang(v as "en" | "ta")}>
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="ta">தமிழ்</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
              <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
                {copy.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-p:my-1 prose-strong:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> …
              </div>
            </div>
          ) : null}
        </div>

        <CardContent className="border-t border-border p-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={copy.placeholder}
              rows={2}
              maxLength={1000}
              className="resize-none"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label={copy.send}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
