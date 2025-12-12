import { useEffect, useState, useRef } from 'react';
import mermaid from "mermaid";

export default function FamilyTreeApp() {
  const [people, setPeople] = useState({
    "1": { id:"1", name:"You", birth:"1980", death:"", img:"", parents:[], children:[] }
  });
  const [currentEdit, setCurrentEdit] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name:"", birth:"", death:"", img:"" });
  const treeRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false });
    renderTree();
  }, [people]);

  function renderTree(){
    let chart = `flowchart TD
`;

    Object.values(people).forEach(p => {
      chart += `${p.id}["${p.name}\n${p.birth}${p.death?`-`+p.death:""}"]
`;
    });
    Object.values(people).forEach(p => {
      p.parents.forEach(par => { chart += `${par}-->${p.id}
`; });
    });

    if (treeRef.current) {
      treeRef.current.innerHTML = `<div class='mermaid'>${chart}</div>`;
      mermaid.init(undefined, treeRef.current.querySelectorAll('.mermaid'));
    }
  }

  function openEdit(id){
    const p = people[id];
    setCurrentEdit(id);
    setForm(p);
    setModalOpen(true);
  }

  function openAdd(){
    setCurrentEdit(null);
    setForm({ name:"", birth:"", death:"", img:"" });
    setModalOpen(true);
  }

  function save(){
    const updated = { ...people };
    let id = currentEdit || String(Date.now());
    updated[id] = { ...updated[id], ...form, id };
    setPeople(updated);
    setModalOpen(false);
  }

  return (
    <div style={{ padding:20 }}>
      <h2>Family Tree</h2>
      <button onClick={openAdd}>Add Member</button>
      <div ref={treeRef} style={{border:"1px solid #ccc",padding:20,borderRadius:10,marginTop:20}} />

      {/* Edit/Add Modal */}
      {modalOpen && (
        <div style={{
          position:"fixed",
          top:0, left:0, right:0, bottom:0,
          background:"rgba(0,0,0,0.5)",
          display:"flex",
          alignItems:"center",
          justifyContent:"center"
        }}>
          <div style={{background:"white",padding:20,width:300,borderRadius:10}}>
            <h3>Edit Person</h3>

            <input 
              placeholder="Name" 
              value={form.name} 
              onChange={e=>setForm({...form,name:e.target.value})} 
            />

            <input 
              placeholder="Birth" 
              value={form.birth} 
              onChange={e=>setForm({...form,birth:e.target.value})} 
            />

            <input 
              placeholder="Death" 
              value={form.death} 
              onChange={e=>setForm({...form,death:e.target.value})} 
            />

            <input 
              placeholder="Image URL" 
              value={form.img} 
              onChange={e=>setForm({...form,img:e.target.value})} 
            />

            <button onClick={save}>Save</button>
            <button onClick={()=>setModalOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
