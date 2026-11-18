'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
export type AdminApi = <T>(url: string, init?: RequestInit) => Promise<T>;
export function useAdminApi(): AdminApi {
  const {accessToken} = useAuth();
  return useCallback(async <T,>(url:string,init?:RequestInit):Promise<T> => {
    if (!accessToken) throw new Error('Your sign-in session is unavailable. Please sign in again.');
    const res = await fetch(url,{...init,cache:'no-store',headers:{...init?.headers,Authorization:`Bearer ${accessToken}`}});
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? 'The request failed. Please retry.');
    if (data === null) throw new Error('The server returned an unreadable response. Please retry.');
    return data as T;
  },[accessToken]);
}
export function useAdminQuery<T>(api:AdminApi,url:string) {
  const [version,setVersion] = useState(0);
  const [result,setResult] = useState<{api:AdminApi;url:string;version:number;data:T|null;error:string}|null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<T>(url,{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setResult({api,url,version,data,error:''});})
      .catch(e=>{if(!controller.signal.aborted)setResult({api,url,version,data:null,error:e instanceof Error?e.message:'Could not load data.'});});
    return ()=>controller.abort();
  },[api,url,version]);
  const current=result?.api===api && result?.url===url && result?.version===version ? result : null;
  return {data:current?.data??null,error:current?.error??'',loading:!current,reload:()=>setVersion(v=>v+1)};
}
