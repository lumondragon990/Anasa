import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isInternal } from "@/lib/permissions";

/**
 * Protected download. The document row is read with the user's own session,
 * so Row Level Security decides access; the file link is valid for 60 seconds.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !user.isActive || !isInternal(user.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("File not found or not available to your role.", { status: 404 });

  const inline = request.nextUrl.searchParams.get("view") === "1";
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, inline ? undefined : { download: doc.file_name });
  if (error || !data) return new NextResponse("The file could not be opened. Try again.", { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
