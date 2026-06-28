import { NextResponse } from "next/server";
import { buildHoldingsFromItems } from "@/lib/parse-holdings";
import {
  extractTextWithOpenAIVision,
  parseImageOcrText,
} from "@/lib/image-parser";
import { parseHoldingsFromText } from "@/lib/parse-holdings";
import { fetchQuotes } from "@/lib/quotes";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let ocrText = "";
    let imageBase64: string | undefined;
    let mimeType = "image/png";
    let usedVision = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image");
      ocrText = String(form.get("ocrText") ?? "").trim();

      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageBase64 = buffer.toString("base64");
        mimeType = file.type || "image/png";
      }
    } else {
      const body = (await request.json()) as {
        ocrText?: string;
        imageBase64?: string;
        mimeType?: string;
      };
      ocrText = body.ocrText?.trim() ?? "";
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType ?? "image/png";
    }

    if (!ocrText && imageBase64 && process.env.OPENAI_API_KEY) {
      ocrText = await extractTextWithOpenAIVision(imageBase64, mimeType);
      usedVision = true;
    }

    if (!ocrText) {
      return NextResponse.json(
        {
          error:
            "No text extracted. Upload an image and run OCR, or paste OCR text. Set OPENAI_API_KEY on the server for automatic vision extraction.",
        },
        { status: 400 },
      );
    }

    const imageSegments = parseImageOcrText(ocrText);
    const { items, cash, segmentCount } = await parseHoldingsFromText(
      ocrText,
      imageSegments,
    );

    if (items.length === 0) {
      return NextResponse.json({
        items: [],
        holdings: [],
        cash: 0,
        transcript: ocrText,
        usedVision,
        message:
          "Could not parse holdings from screenshot text. Try a clearer image or edit the extracted text below.",
      });
    }

    const allSymbols = [
      ...new Set(
        items
          .map((it) => it.selectedSymbol)
          .filter((s): s is string => Boolean(s)),
      ),
    ];
    const quotes = allSymbols.length > 0 ? await fetchQuotes(allSymbols) : [];
    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));

    for (const item of items) {
      item.recommendations = item.recommendations.map((r) => ({
        ...r,
        price: priceMap.get(r.symbol) ?? null,
      }));
    }

    const holdings = buildHoldingsFromItems(items, priceMap);

    return NextResponse.json({
      items,
      holdings,
      cash,
      transcript: ocrText,
      parsedCount: segmentCount,
      usedVision,
      visionAvailable: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
