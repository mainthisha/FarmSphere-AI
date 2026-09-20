import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sprout } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authApi, farmApi, setToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [farmSize, setFarmSize] = useState("5");
  const [crops, setCrops] = useState("Rice, Groundnut");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await authApi.login({ email, password });
    setLoading(false);
    if (error || !data) return toast.error(error ?? "Login failed");
    setToken(data.token);
    setUser(data.user);
    toast.success("Welcome back!");
    navigate("/dashboard");
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const preferred = crops
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const { data, error } = await authApi.register({
      email,
      password,
      full_name: fullName,
      location,
      farm_size: Number(farmSize) || 5,
    });
    setLoading(false);
    if (error || !data) return toast.error(error ?? "Registration failed");
    setToken(data.token);
    setUser(data.user);
    // Preferred crops are saved as a follow-up profile update once the
    // farm/profile/zones have been auto-provisioned on the backend.
    if (preferred.length) {
      await farmApi.updateProfile({ preferred_crops: preferred });
    }
    toast.success("Farm registered — building your digital twin.");
    navigate("/dashboard");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ background: "var(--gradient-sky)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sprout className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">FarmSphere AI</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Farmer access</CardTitle>
            <CardDescription>Sign in or register your farm to open your digital twin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-4 pt-4" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="farmer@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="space-y-4 pt-4" onSubmit={handleRegister}>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      required
                      maxLength={80}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Muthu Kumar"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        required
                        maxLength={80}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Erode, Tamil Nadu"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="size">Farm size (acres)</Label>
                      <Input
                        id="size"
                        type="number"
                        min={0.1}
                        step={0.1}
                        required
                        value={farmSize}
                        onChange={(e) => setFarmSize(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="crops">Preferred crops</Label>
                    <Input
                      id="crops"
                      maxLength={120}
                      value={crops}
                      onChange={(e) => setCrops(e.target.value)}
                      placeholder="Rice, Cotton"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Create farm account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
