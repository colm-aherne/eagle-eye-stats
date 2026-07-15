import { useEffect, useState } from "react";

const KEY = "eagleeye.courseLocations.v1";

export type CourseLocationMap = Record<string, string>;

function read(): CourseLocationMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CourseLocationMap) : {};
  } catch {
    return {};
  }
}

export function rememberCourseLocation(name: string, location?: string | null) {
  if (typeof window === "undefined") return;
  const n = name?.trim();
  const l = location?.trim();
  if (!n || !l) return;
  const map = read();
  if (map[n] === l) return;
  map[n] = l;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
}

export function useCourseLocations() {
  const [map, setMap] = useState<CourseLocationMap>({});
  useEffect(() => {
    setMap(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMap(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return map;
}
