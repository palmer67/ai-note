import { NextResponse } from "next/server";

import { askCollection } from "@/lib/openai/ask-collection";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

const MAX_COLLECTION_NOTES = 5;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用资料集问答功能。" }, { status: 401 });
  }

  let noteIds: string[] = [];
  let question: string | null = null;

  try {
    const body = (await request.json()) as { noteIds?: string[]; question?: string };
    noteIds = Array.isArray(body.noteIds) ? body.noteIds.map((id) => String(id).trim()).filter(Boolean) : [];
    question = body.question?.trim() ?? null;
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  if (!noteIds.length) {
    return NextResponse.json({ error: "请先选择至少一篇资料。" }, { status: 400 });
  }

  if (noteIds.length > MAX_COLLECTION_NOTES) {
    return NextResponse.json({ error: `当前最多只能基于 ${MAX_COLLECTION_NOTES} 篇资料提问。` }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "请先输入你的问题。" }, { status: 400 });
  }

  const { data, error } = await supabase.from("notes").select("*").in("id", noteIds);

  if (error) {
    return NextResponse.json({ error: "加载资料集失败。" }, { status: 500 });
  }

  const notes = ((data as Note[] | null) ?? []).filter((note) => noteIds.includes(note.id));

  if (!notes.length) {
    return NextResponse.json({ error: "没有找到可用的资料。" }, { status: 404 });
  }

  try {
    const result = await askCollection({
      notes,
      question
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "资料集问答时发生了意外错误。"
      },
      { status: 500 }
    );
  }
}
