import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ channelIdOrSlug: string }> };
export async function GET(request: Request, context: Context) {
  const token = await getAccessToken(); if (!token) return Response.json({ ok:false,error:{code:"AUTH_REQUIRED",message:"Please sign in."}},{status:401});
  const { channelIdOrSlug } = await context.params; const target = new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/media`, apiBaseUrl());
  new URL(request.url).searchParams.forEach((value,key)=>target.searchParams.set(key,value));
  const response = await fetch(target,{headers:{accept:"application/json",authorization:`Bearer ${token}`},cache:"no-store"});
  return new Response(await response.text(),{status:response.status,headers:{"content-type":"application/json"}});
}
