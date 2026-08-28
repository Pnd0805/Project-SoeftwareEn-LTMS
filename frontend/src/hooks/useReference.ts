/**
 * src/hooks/useReference.ts — R01-R03
 * staleTime: Infinity เพราะข้อมูลอ้างอิงแทบไม่เปลี่ยนระหว่าง session (ไม่ต้อง refetch ทุกครั้ง)
 */
import { useQuery } from "@tanstack/react-query";
import * as referenceApi from "../api/reference";

export function useFaculties() {
  return useQuery({
    queryKey: ["faculties"],
    queryFn: referenceApi.getFaculties,
    staleTime: Infinity,
  });
}

export function useDepartments(facultyId: number | undefined) {
  return useQuery({
    queryKey: ["departments", facultyId],
    queryFn: () => referenceApi.getDepartments(facultyId as number),
    enabled: facultyId !== undefined,
    staleTime: Infinity,
  });
}

export function useSportTypes() {
  return useQuery({
    queryKey: ["sportTypes"],
    queryFn: referenceApi.getSportTypes,
    staleTime: Infinity,
  });
}
