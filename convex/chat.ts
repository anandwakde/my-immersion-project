import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { computeStatus } from "./status";

const SYSTEM_PROMPT = `You are a compliance assistant for the Payment Scheme Intelligence Monitor, a tool that tracks real payment-scheme regulatory circulars (Visa, Mastercard, Mada, and others) for a compliance team at a payment service provider.

You will be given the system's current, real circulars and tasks as JSON. Answer the user's question using ONLY that data — never invent a circular, scheme, date, or fact that isn't in it. If the answer isn't in the data provided, say so plainly rather than guessing. Reference specific circulars/tasks by name when relevant. Keep answers concise and conversational, a few sentences unless the question genuinely needs a list.

Respond in plain text only — this renders in a plain chat bubble with no markdown support. Do not use **bold**, [links](url), or markdown list syntax. For a list, just use plain line breaks with a dash, e.g. "- Item one". If you want to point to a source, just say the URL as plain text.`;

export const askAssistant = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set on this deployment");
    }

    const circulars: {
      scheme: string;
      title: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null | undefined;
      scope: string;
      sourceUrl: string;
    }[] = await ctx.runQuery(api.circulars.list, {});
    const now = Date.now();
    const circularsWithStatus = circulars.map((c) => ({
      scheme: c.scheme,
      title: c.title,
      urgency: c.urgency,
      deadline: c.deadline,
      status: computeStatus(c.urgency, c.deadlineDate, now),
      scope: c.scope,
      sourceUrl: c.sourceUrl,
    }));

    const tasks: {
      circularTitle: string;
      circularScheme: string;
      team: string;
      deadline: string | null;
      status: string;
    }[] = await ctx.runQuery(api.tasks.list, {});
    const tasksWithOverdue = tasks.map((t) => {
      const deadlineMs = t.deadline ? Date.parse(t.deadline + "T00:00:00Z") : NaN;
      const overdue = t.status === "open" && !Number.isNaN(deadlineMs) && deadlineMs < now;
      return { ...t, overdue };
    });

    const userMessage = `CIRCULARS:\n${JSON.stringify(circularsWithStatus, null, 2)}\n\nTASKS:\n${JSON.stringify(tasksWithOverdue, null, 2)}\n\nQuestion: ${args.question}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) {
      throw new Error("OpenAI response had no content");
    }

    return answer;
  },
});
