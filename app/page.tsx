"use client";

import { useEffect, useState } from "react";

const UNIT: Record<string, string> = {
  "Air Temperature": "°C",
  "Atmospheric Pressure": "kPa",
  "Battery Percent": "%",
  "Battery Voltage": "mV",
  "EC": "dS/m",
  "Logger Temperature": "°C",
  "Reference Pressure": "kPa",
  "Relative Humidity": "%",
  "VPD": "kPa",
  "Water Level": "mm",
  "Water Temperature": "°C",
};

export default function Page() {
  const [data, setData] = useState<any>(null);
  const [pick, setPick] = useState<string[]>(Array(6).fill(""));

  const load = async () => {
    const r = await fetch("/api/zentra/latest", { cache: "no-store" });
    setData(await r.json());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <p style={{ padding: 20 }}>불러오는 중…</p>;

  if (data.error) {
    return (
      <main style={{ padding: 20 }}>
        <h3>에러</h3>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </main>
    );
  }

  const channels: string[] = data.channels ?? [];
  const latestBy: Record<string, any[]> = data.latest_by_channel ?? {};

  return (
    <main style={{ padding: 20 }}>
      <h2>ZL6 현재 데이터</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {pick.map((p, i) => {
          const rows = p ? latestBy[p] ?? [] : [];
          const r0 = rows[0];

          return (
            <div key={i} style={{ border: "1px solid #ccc", padding: 12 }}>
              <select
                value={p}
                onChange={(e) => {
                  const n = [...pick];
                  n[i] = e.target.value;
                  setPick(n);
                }}
              >
                <option value="">채널 선택</option>
                {channels.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div style={{ fontSize: 28 }}>
                {p ? r0?.value ?? "-" : "-"} {UNIT[p] ?? ""}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
