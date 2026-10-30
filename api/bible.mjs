/* KNOWN Daily: auth-protected API.Bible proxy. No API key is sent to a browser. */
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options':'nosniff' }
});
export async function GET(request) {
  const key = process.env.API_BIBLE_KEY;
  const supabaseUrl = process.env.KNOWN_SUPABASE_URL;
  const supabasePublicKey = process.env.KNOWN_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !supabaseUrl || !supabasePublicKey) return json({error:'Vercel environment variables are missing. Set API_BIBLE_KEY, KNOWN_SUPABASE_URL and KNOWN_SUPABASE_PUBLISHABLE_KEY; redeploy.'},503);
  // Do not expose the publisher key via a public unauthenticated proxy.
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer [A-Za-z0-9._~+\/-]+$/.test(auth)) return json({error:'Sign in to KNOWN Daily first.'},401);
  try {
    const authUrl = new URL('/auth/v1/user',supabaseUrl);
    if (authUrl.protocol !== 'https:') return json({error:'Invalid Supabase URL configuration.'},503);
    const check = await fetch(authUrl,{headers:{authorization:auth,apikey:supabasePublicKey},signal:AbortSignal.timeout(7000)});
    if (!check.ok) return json({error:'Your KNOWN Daily session has expired. Please sign in again.'},401);
    const currentUser=await check.json();
    if (!currentUser?.id) return json({error:'No authorized user session.'},401);
    const u=new URL(request.url), mode=u.searchParams.get('mode');
    let path;
    if(mode==='versions') path='/v1/bibles?language=eng';
    else if(mode==='chapter') {
      const bibleId=u.searchParams.get('bibleId')||'', chapterId=u.searchParams.get('chapterId')||'';
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(bibleId) || !/^[1-3]?[A-Z]{2,3}\.[1-9][0-9]{0,2}$/.test(chapterId))return json({error:'Invalid Bible or chapter selection.'},400);
      path=`/v1/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}?content-type=text&include-verse-numbers=true&include-titles=true`;
    }else return json({error:'Unsupported request.'},400);
    const upstream=await fetch(`https://rest.api.bible${path}`,{headers:{'api-key':key,'Accept':'application/json'},signal:AbortSignal.timeout(9000)});
    let data;
    try {data=await upstream.json();}catch{return json({error:'Unexpected response from API.Bible.'},502);}
    if(!upstream.ok){
      const error=upstream.status===401?'API.Bible rejected the server-side key. Rotate it and verify the Vercel setting.':upstream.status===403?'This translation is not licensed for your API.Bible account.':upstream.status===429?'API.Bible request limit reached.':`API.Bible returned HTTP ${upstream.status}.`;
      return json({error},upstream.status===429?429:502);
    }
    if(mode==='versions') {
      const versions=(Array.isArray(data.data)?data.data:[]).filter(v=>v?.id && (v.language?.id==='eng'||v.language?.id==='en'||/english/i.test(v.language?.name||'')))
        .map(v=>({id:v.id,abbreviation:v.abbreviation||'',name:v.name||'',copyright:v.copyright||''}))
        .sort((a,b)=>{
          const rank=v=>/^(NLT|NIV)$/i.test(v.abbreviation)?0:1;
          return rank(a)-rank(b) || a.name.localeCompare(b.name);
        });
      return json({data:versions});
    }
    const c=data.data||{};
    return json({data:{reference:c.reference||'',content:typeof c.content==='string'?c.content:'',copyright:c.copyright||''},
      meta:{fumsToken:data.meta?.fumsToken||null,fumsId:data.meta?.fumsId||null}});
  } catch(err){
    return json({error:err?.name==='TimeoutError'?'The Bible service did not respond in time.':'Unable to load Bible content. Check your connection and Vercel logs.'},502);
  }
}
