import type { UIMessage } from 'ai'
/** Keep complete UI-message/tool groups together within a bounded model context. */
export function limitEncoreContext(messages:UIMessage[],maxChars=64_000):UIMessage[] {
  let used=0,start=messages.length
  for(let i=messages.length-1;i>=0;i--){
    const size=JSON.stringify(messages[i]).length
    if(start<messages.length && used+size>maxChars)break
    used+=size;start=i
  }
  return messages.slice(start)
}
