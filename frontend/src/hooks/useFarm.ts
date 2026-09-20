import { useQuery, useQueryClient } from "@tanstack/react-query";

import { farmApi, type Farm, type FarmZone, type Profile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type { Profile, Farm, FarmZone };

export function useUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}

export function useFarmData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["farm-data"],
    enabled: !!user,
    queryFn: async () => {
      const data = await farmApi.getFarmData();
      return {
        profile: data.profile,
        farm: data.farm,
        zones: data.zones ?? [],
      };
    },
  });
}

export function useInvalidateFarm() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["farm-data"] });
}
