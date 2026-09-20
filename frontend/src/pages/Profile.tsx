import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { farmApi } from "@/lib/api";
import { useFarmData, useInvalidateFarm, useUser } from "@/hooks/useFarm";
import { CROP_LIST, SOIL_TYPES } from "@/lib/agri";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(80),
  location: z.string().trim().min(1, "Location is required").max(80),
  farm_size: z.number().min(0.1).max(10000),
  phone: z.string().trim().max(20).optional(),
  preferred_crops: z.array(z.string()).max(10),
});

export default function ProfilePage() {
  const { data } = useFarmData();
  const { user } = useUser();
  const invalidate = useInvalidateFarm();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    location: "",
    farm_size: "5",
    phone: "",
    crops: "",
    language: "en",
  });
  const [farmForm, setFarmForm] = useState({
    name: "",
    location: "",
    total_area: "5",
    soil_type: "Loamy",
    water_source: "Borewell",
    current_crop: "Rice",
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        full_name: data.profile.full_name,
        location: data.profile.location,
        farm_size: String(data.profile.farm_size),
        phone: data.profile.phone ?? "",
        crops: (data.profile.preferred_crops ?? []).join(", "),
        language: data.profile.language,
      });
    }
    if (data?.farm) {
      setFarmForm({
        name: data.farm.name,
        location: data.farm.location,
        total_area: String(data.farm.total_area),
        soil_type: data.farm.soil_type,
        water_source: data.farm.water_source,
        current_crop: data.farm.current_crop,
      });
    }
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      full_name: form.full_name,
      location: form.location,
      farm_size: Number(form.farm_size),
      phone: form.phone,
      preferred_crops: form.crops.split(",").map((c) => c.trim()).filter(Boolean),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSaving(true);
    const { error: profileError } = await farmApi.updateProfile({
      ...parsed.data,
      language: form.language,
    });

    const { error: farmError } = await farmApi.saveFarm({
      name: farmForm.name || "My Farm",
      location: farmForm.location,
      total_area: Number(farmForm.total_area) || 1,
      soil_type: farmForm.soil_type,
      water_source: farmForm.water_source,
      current_crop: farmForm.current_crop,
    });

    setSaving(false);
    if (profileError || farmError) return toast.error(profileError ?? farmError ?? "Could not save changes");
    invalidate();
    toast.success("Profile updated");
  }

  return (
    <AppShell title="Farmer Profile" subtitle={user?.email}>
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={save}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Farmer details</CardTitle>
            <CardDescription>Used to personalise recommendations and the AI assistant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Full name" id="full_name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Location" id="location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Field
              label="Farm size (acres)"
              id="farm_size"
              type="number"
              value={form.farm_size}
              onChange={(v) => setForm({ ...form, farm_size: v })}
            />
            <Field label="Phone" id="phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field
              label="Preferred crops (comma separated)"
              id="crops"
              value={form.crops}
              onChange={(v) => setForm({ ...form, crops: v })}
            />
            <div className="space-y-1.5">
              <Label>Assistant language</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Farm information</CardTitle>
            <CardDescription>This powers your digital twin and every prediction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Farm name" id="farm_name" value={farmForm.name} onChange={(v) => setFarmForm({ ...farmForm, name: v })} />
            <Field
              label="Farm location"
              id="farm_location"
              value={farmForm.location}
              onChange={(v) => setFarmForm({ ...farmForm, location: v })}
            />
            <Field
              label="Total area (acres)"
              id="total_area"
              type="number"
              value={farmForm.total_area}
              onChange={(v) => setFarmForm({ ...farmForm, total_area: v })}
            />
            <div className="space-y-1.5">
              <Label>Soil type</Label>
              <Select value={farmForm.soil_type} onValueChange={(v) => setFarmForm({ ...farmForm, soil_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOIL_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Water source</Label>
              <Select value={farmForm.water_source} onValueChange={(v) => setFarmForm({ ...farmForm, water_source: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Borewell", "Canal", "Rain-fed", "River", "Tank"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current crop</Label>
              <Select value={farmForm.current_crop} onValueChange={(v) => setFarmForm({ ...farmForm, current_crop: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CROP_LIST.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
