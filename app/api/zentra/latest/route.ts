import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ✅ 한 시간에 1번만 ZENTRA 호출
let cache: any = null;
let lastFetchedHourKey: string | null = null;

function hourKey(d: Date) {
  // 예: "2025-12-12 16"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}`;
}

function latest1FromChannelOutputs(channelOutputs: any[]) {
  if (!Array.isArray(channelOutputs)) return [];

  const flat: any[] = [];

  for (const out of channelOutputs) {
    const units = out?.units ?? null;
    const sensor_name = out?.metadata?.sensor_name ?? null;

    const readings = Array.isArray(out?.readings) ? out.readings : [];
    for (const r of readings) {
      // 정상값 우선
      if (r?.value != null && !r?.error_flag) {
        flat.push({
          datetime: r?.datetime ?? null,
          value: r?.value ?? null,
          error_flag: !!r?.error_flag,
          error_description: r?.error_description ?? null,
          units,
          sensor_name,
        });
      }
    }
  }

  flat.sort((a, b) => new Date(b.datetime ?? 0).getTime() - new Date(a.datetime ?? 0).getTime());
  return flat.slice(0, 1);
}

export async function GET() {
  const token = process.env.ZENTRA_TOKEN;
  const device = process.env.ZENTRA_DEVICE_SN;

  if (!token || !device) {
    return NextResponse.json({ error: "환경변수 없음 (.env.local 확인)" }, { status: 500 });
  }

  const now = new Date();
  const nowKey = hourKey(now);

  // ✅ 이번 “시간”에 이미 가져왔으면 캐시 반환
  if (cache && lastFetchedHourKey === nowKey) {
    return NextResponse.json({ ...cache, cached: true, hour_key: nowKey });
  }

  // ✅ 시간 바뀌었으면 1번만 ZENTRA 호출
  const url = new URL("https://zentracloud.com/api/v4/get_readings/");
  url.searchParams.set("device_sn", device);
  url.searchParams.set("per_page", "2000");
  url.searchParams.set("page_num", "1");
  url.searchParams.set("output_format", "json");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: "ZENTRA API 호출 실패", status: res.status, body },
      { status: 502 }
    );
  }

  const raw = await res.json();
  const channelMap = raw?.data ?? {};
  const channels = Object.keys(channelMap);

  const latest_by_channel: Record<string, any[]> = {};
  for (const ch of channels) {
    latest_by_channel[ch] = latest1FromChannelOutputs(channelMap[ch]);
  }

  cache = {
    device,
    channels,
    latest_by_channel,
    fetched_at: new Date().toISOString(),
    pagination: raw?.pagination ?? null,
  };
  lastFetchedHourKey = nowKey;

  return NextResponse.json({ ...cache, cached: false, hour_key: nowKey });
}
