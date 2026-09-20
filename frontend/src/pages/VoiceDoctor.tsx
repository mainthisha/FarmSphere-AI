import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useFarmData } from "@/hooks/useFarm";
import { useConsultations, useSaveConsultation } from "@/hooks/useIntel";
import { requestTts, requestVoiceDoctor } from "@/lib/api";

type Diagnosis = {
  cause: string;
  probability: number;
  disease: string;
  action: string[];
  prevention: string[];
  spoken: string;
};

const SAMPLES: Record<"ta" | "en", string[]> = {
  ta: ["என் நெல் பயிர் மஞ்சளாகிறது", "இலைகளில் வெள்ளை புள்ளிகள் வருகிறது", "என்ன உரம் பயன்படுத்த வேண்டும்"],
  en: ["My paddy leaves are turning yellow", "White spots are appearing on the leaves", "Which fertilizer should I use now?"],
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognition(lang: string): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = false;
  return rec;
}

export default function VoiceDoctorPage() {
  const { data } = useFarmData();
  const consultations = useConsultations();
  const saveConsultation = useSaveConsultation();

  const [language, setLanguage] = useState<"ta" | "en">("ta");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  function toggleListening() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition(language === "ta" ? "ta-IN" : "en-IN");
    if (!rec) {
      toast.error("Speech recognition is not supported in this browser. Please type your question.");
      return;
    }
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ");
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("Could not hear you clearly. Please try again.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function speak(message: string) {
    setSpeaking(true);
    try {
      const blob = await requestTts({ text: message, language });
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      // No server-side TTS configured (or it failed) — browser speech
      // synthesis keeps the voice reply working fully offline.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(message);
        utter.lang = language === "ta" ? "ta-IN" : "en-IN";
        utter.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
      } else {
        setSpeaking(false);
        toast.error("Voice playback is unavailable right now.");
      }
    }
  }

  async function consult(question?: string) {
    const query = (question ?? text).trim();
    if (!query) return toast.error(language === "ta" ? "முதலில் உங்கள் கேள்வியை சொல்லுங்கள்." : "Please ask a question first.");
    setText(query);
    setLoading(true);
    setResult(null);
    try {
      const json = await requestVoiceDoctor({
        query,
        language,
        context: `Crop: ${data?.farm?.current_crop ?? "unknown"}, location: ${data?.farm?.location ?? "Tamil Nadu"}, soil: ${data?.farm?.soil_type ?? "unknown"}`,
      });
      if (!json.result) throw new Error(json.error ?? "Consultation failed");
      const diagnosis = json.result as Diagnosis;
      setResult(diagnosis);
      void speak(diagnosis.spoken);
      saveConsultation.mutate({ language, query, response: diagnosis.spoken, status: "Answered" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Consultation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Voice Farm Doctor" subtitle="Speak in Tamil or English and get a spoken AI diagnosis">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Ask the farm doctor</CardTitle>
                <CardDescription>Tap the mic and speak naturally, or type your question.</CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg bg-secondary p-1">
                {(["ta", "en"] as const).map((l) => (
                  <Button key={l} size="sm" variant={language === l ? "default" : "ghost"} onClick={() => setLanguage(l)}>
                    {l === "ta" ? "தமிழ்" : "English"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6">
              <Button
                size="lg"
                variant={listening ? "destructive" : "default"}
                className="size-20 rounded-full"
                onClick={toggleListening}
                aria-label={listening ? "Stop recording" : "Start recording"}
              >
                {listening ? <Square className="size-7" /> : <Mic className="size-7" />}
              </Button>
              <p className="text-xs text-muted-foreground">
                {listening
                  ? language === "ta"
                    ? "கேட்டுக்கொண்டிருக்கிறேன்…"
                    : "Listening…"
                  : language === "ta"
                    ? "பேச மைக்கை அழுத்துங்கள்"
                    : "Tap the mic to speak"}
              </p>
            </div>

            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={language === "ta" ? "உங்கள் கேள்வி இங்கே தோன்றும்…" : "Your recognised question appears here…"}
            />

            <div className="flex flex-wrap gap-2">
              {SAMPLES[language].map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => consult(s)} disabled={loading}>
                  {s}
                </Button>
              ))}
            </div>

            <Button className="w-full gap-2" onClick={() => consult()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
              {language === "ta" ? "ஆலோசனை பெறுக" : "Get diagnosis"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!result ? (
              <p className="text-muted-foreground">{loading ? "Analysing your question…" : "Ask a question to receive a spoken diagnosis."}</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{result.disease}</p>
                    <p className="text-xs text-muted-foreground">Possible cause</p>
                  </div>
                  <Badge variant="secondary">{Math.round(result.probability)}% probability</Badge>
                </div>
                <Progress value={result.probability} />
                <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">{result.cause}</p>
                <List title={language === "ta" ? "பரிந்துரைக்கப்பட்ட நடவடிக்கை" : "Recommended action"} items={result.action} />
                <List title={language === "ta" ? "தடுப்பு குறிப்புகள்" : "Prevention tips"} items={result.prevention} />
                <Button variant="outline" className="w-full gap-2" onClick={() => speak(result.spoken)} disabled={speaking}>
                  {speaking ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                  {language === "ta" ? "மீண்டும் கேளுங்கள்" : "Play voice reply"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Consultation history</CardTitle>
          <CardDescription>Your previous voice consultations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(consultations.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No consultations yet.</p>
          ) : (
            (consultations.data ?? []).map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{c.language === "ta" ? "தமிழ்" : "English"}</Badge>
                    <Badge variant="secondary">{c.status}</Badge>
                  </span>
                </div>
                <p className="mt-2 font-medium">{c.query}</p>
                <p className="mt-1 text-muted-foreground">{c.response}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
