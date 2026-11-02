import { handleIdealSelf } from "../src/server/idealSelf/service";

export default async function idealSelf(req:any,res:any) {
  res.setHeader("Cache-Control","no-store");
  if(Buffer.byteLength(JSON.stringify(req.body??{}),"utf8")>65536) {res.status(413).json({code:"input_too_large",error:"This request is too large."});return;}
  const result=await handleIdealSelf({method:req.method,authorization:req.headers.authorization,body:req.body},process.env);
  res.status(result.status).json(result.json);
}
