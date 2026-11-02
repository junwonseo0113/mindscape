import { supabase } from "../supabaseClient";
import type { IdealSelfSnapshot, Profile } from "./model";

export class IdealSelfRequestError extends Error {
  constructor(public code:string,message:string,public status:number) {super(message);}
}
export async function idealSelfRequest<T>(body:Record<string,unknown>):Promise<T> {
  let session;
  try { session=await supabase?.auth.getSession(); } catch { throw new IdealSelfRequestError("session_unavailable","Could not verify your session. Your draft is still here.",401); }
  const token=session?.data.session?.access_token;
  if(!token) throw new IdealSelfRequestError("unauthorized","Sign in with your account to save an Ideal Self profile.",401);
  let response:Response;
  try {response=await fetch("/api/ideal-self",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body),cache:"no-store"});}
  catch {throw new IdealSelfRequestError("offline","Could not connect. Your draft is still here; try again when connected.",0);}
  let data:any;
  try {data=await response.json();} catch {throw new IdealSelfRequestError("unavailable","Ideal Self is unavailable. Your draft is still here.",response.status);}
  if(!response.ok) throw new IdealSelfRequestError(data.code??"request_failed",data.error??"Could not complete this request. Your draft is still here.",response.status);
  return data as T;
}
export const loadIdealSelf=()=>idealSelfRequest<IdealSelfSnapshot>({operation:"load"});
export async function deleteIdealSelfForReset():Promise<void> {
  if(!supabase) return;
  const {data,error}=await supabase.auth.getSession();
  if(error) throw new Error("Could not verify the account before deleting Ideal Self data. Try again.");
  if(!data.session) return;
  // A missing migration means no Ideal Self rows can have been written by this installation.
  // Do not swallow other failures: preserve the existing data so a reset can be retried.
  await idealSelfRequest<{deleted:boolean}>({operation:"delete_profile"});
}
export type SaveProfileResponse={profile:Profile};
