import { NextResponse } from "next/server";
import seedData from "@/data/short-interest-seed.json";
import type { ShortInterestRow } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 50);
  const sector = searchParams.get("sector");
  const minFloat = Number(searchParams.get("minFloat") ?? 0);

  let rows = seedData as ShortInterestRow[];

  if (sector) {
    rows = rows.filter(
      (r) => r.sector.toLowerCase() === sector.toLowerCase(),
    );
  }

  if (minFloat > 0) {
    rows = rows.filter((r) => r.floatShortPercent >= minFloat);
  }

  return NextResponse.json({
    rows: rows.slice(0, limit),
    meta: {
      total: rows.length,
      source:
        "Sample seed data. Replace with FINRA API for production (finra.org/finra-data).",
      disclaimer: "Not investment advice. Short interest data has ~2 week lag on FINRA.",
    },
  });
}
