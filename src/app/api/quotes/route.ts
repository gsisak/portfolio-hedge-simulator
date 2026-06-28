import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/quotes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols");

  if (!symbols) {
    return NextResponse.json(
      { error: "Provide ?symbols=AAPL,MSFT,GLD" },
      { status: 400 },
    );
  }

  const list = symbols.split(",").map((s) => s.trim()).filter(Boolean);
  const quotes = await fetchQuotes(list);

  return NextResponse.json({ quotes });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { symbols?: string[] };

  if (!body.symbols?.length) {
    return NextResponse.json({ error: "symbols array required" }, { status: 400 });
  }

  const quotes = await fetchQuotes(body.symbols);
  return NextResponse.json({ quotes });
}
