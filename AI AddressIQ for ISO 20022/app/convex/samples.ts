import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SOURCE =
  "Adapted from a real pacs.008.001.09 sample message in issettled/iso20022-issettled (GitHub): " +
  "https://github.com/issettled/iso20022-issettled/blob/main/examples/en/settlement-method-TDSA/payment-dsa/pacs.008.001.09.xml";

const SEED_DATA = [
  {
    category: "structured" as const,
    label: "New York, US",
    order: 0,
    text: `<PstlAdr>
  <StrtNm>Times Square</StrtNm>
  <BldgNb>7</BldgNb>
  <PstCd>10036</PstCd>
  <TwnNm>New York</TwnNm>
  <Ctry>US</Ctry>
</PstlAdr>`,
  },
  {
    category: "structured" as const,
    label: "Zurich, CH",
    order: 1,
    text: `<PstlAdr>
  <StrtNm>Hochstrasse</StrtNm>
  <BldgNb>27</BldgNb>
  <PstCd>8022</PstCd>
  <TwnNm>Zurich</TwnNm>
  <Ctry>CH</Ctry>
</PstlAdr>`,
  },
  {
    category: "hybrid" as const,
    label: "New York, US",
    order: 0,
    text: `<PstlAdr>
  <TwnNm>New York</TwnNm>
  <Ctry>US</Ctry>
  <AdrLine>7 Times Square</AdrLine>
  <AdrLine>10036</AdrLine>
</PstlAdr>`,
  },
  {
    category: "hybrid" as const,
    label: "Zurich, CH",
    order: 1,
    text: `<PstlAdr>
  <TwnNm>Zurich</TwnNm>
  <Ctry>CH</Ctry>
  <AdrLine>Hochstrasse 27</AdrLine>
  <AdrLine>8022</AdrLine>
</PstlAdr>`,
  },
  {
    category: "unstructured" as const,
    label: "New York, US",
    order: 0,
    text: `<PstlAdr>
  <Ctry>US</Ctry>
  <AdrLine>7 Times Square, New York 10036</AdrLine>
</PstlAdr>`,
  },
  {
    category: "unstructured" as const,
    label: "Zurich, CH",
    order: 1,
    text: "Hochstrasse 27, 8022 Zurich, Switzerland",
  },
];

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sampleAddresses"),
      _creationTime: v.number(),
      category: v.union(
        v.literal("structured"),
        v.literal("hybrid"),
        v.literal("unstructured"),
      ),
      label: v.string(),
      text: v.string(),
      source: v.string(),
      order: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("sampleAddresses").order("asc").take(50);
  },
});

export const seed = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("sampleAddresses").take(1);
    if (existing.length > 0) return null;
    for (const sample of SEED_DATA) {
      await ctx.db.insert("sampleAddresses", { ...sample, source: SOURCE });
    }
    return null;
  },
});
