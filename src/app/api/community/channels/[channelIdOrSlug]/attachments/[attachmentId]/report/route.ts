import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ channelIdOrSlug:string; attachmentId:string }> };
export async function POST(request:Request, context:Context) {
  const token=await getAccessToken(); if(!token)return Response.json({ok:false,error:{code:"AUTH_REQUIRED",message:"Please sign in."}},{status:401});
  const {channelIdOrSlug,attachmentId}=await context.params; const response=await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments/${encodeURIComponent(attachmentId)}/report`,apiBaseUrl()),{method:"POST",headers:buildApiProxyHeaders(request,{accept:"application/json",authorization:`Bearer ${token}`,"content-type":"application/json"}),body:await request.text(),cache:"no-store"});
  return new Response(await response.text(),{status:response.status,headers:{"content-type":"application/json"}});
}
