import { blankProfile, type Profile, type ProfileFields, type ProfileKey } from "./model";

export type EditorState={draft:ProfileFields;profile:Profile|null;saving:boolean;error:string|null};
export const newEditor=():EditorState=>({draft:blankProfile(),profile:null,saving:false,error:null});
type Action={type:"loaded";profile:Profile|null;preserveDraft?:boolean}|{type:"change";key:ProfileKey;value:string}|{type:"saving"}|{type:"failed";message:string}|{type:"saved";profile:Profile}|{type:"suggestion";fields:ProfileFields}|{type:"reset"};
export function editorReducer(state:EditorState,action:Action):EditorState {
  switch(action.type) {
    case "loaded":return {...state,profile:action.profile,draft:action.preserveDraft?state.draft:action.profile?{...action.profile.fields}:blankProfile(),error:null};
    case "change":return {...state,draft:{...state.draft,[action.key]:action.value},error:null};
    case "saving":return {...state,saving:true,error:null};
    case "failed":return {...state,saving:false,error:action.message};
    case "saved":return {profile:action.profile,draft:{...action.profile.fields},saving:false,error:null};
    case "suggestion":return {...state,draft:{...action.fields},error:null};
    case "reset":return newEditor();
  }
}
