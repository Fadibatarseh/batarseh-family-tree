import { useEffect, useState, useRef } from 'react';
import mermaid from "mermaid";

export default function FamilyTreeApp() {
  const [people, setPeople] = useState({
    "1": { id: "1", name: "Grandparent", birth: "1950", death: "", img: "", parents: [], children: ["2"] },
    "2": { id: "2", name: "You", birth: "1980", death: "", img: "", parents: ["1"], children: [] }
  });
  
  const [currentEdit, setCurrentEdit] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", birth: "", death: "", img: "", parentId: "" });
  const treeRef = useRef(null);

  useEffect(() => {
    // We initialize with a specific theme configuration here
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#ff0000',
        lineColor: '#000000',
        secondaryColor: '#f4f4f4',
        tertiaryColor: '#fff'
      }
    });
  }, []); 

  useEffect(() => {
    renderTree();
  }, [people]);

  async function renderTree() {
    if (!treeRef.current) return;

    // We start the chart definition
    let chart = `flowchart TD\n`;

    // 1. ADD STYLING DEFINITIONS (The "Graphics" Code)
    // This says: Fill with white, Red Borders, Rounded Corners (rx, ry)
    chart += `classDef mainNode fill:#fff,stroke:#b91c1c,stroke-width:2px,rx:10,ry:10,color:#000;\n`;
    chart += `linkStyle default stroke:#000,stroke-width:2px;\n`;

    // 2. Draw Nodes
    Object.values(people).forEach(p => {
      const safeName = p.name.replace(/"/g, "'");
      // We attach the ':::mainNode' style to every person
      chart += `${p.id}["<b>${safeName}</b><br/>${p.birth}${p.death ? ` - ${p.death}` : ""}"]:::mainNode\n`;
    });

    // 3. Draw Links
    Object.values(people).forEach(p => {
      if (p.parents && p.parents.length > 0) {
        p.parents.forEach(parId => {
          if (people[parId]) {
            chart += `${parId} --> ${p.id}\n`;
          }
        });
      }
    });

    treeRef.current.innerHTML = `<pre class="mermaid">${chart}</pre>`;
    
    try {
      await mermaid.run({
        nodes: treeRef.current.querySelectorAll('.mermaid'),
      });
    } catch (error) {
      console.error("Mermaid failed to render:", error);
    }
  }

  function openEdit(id) {
    const p = people[id];
    setCurrentEdit(id);
    setForm({ ...p, parentId: p.parents ? p.parents.join(",") : "" });
    setModalOpen(true);
  }

  function openAdd() {
    setCurrentEdit(null);
    setForm({ name: "", birth: "", death: "", img: "", parentId: "" });
    setModalOpen(true);
  }

  function save() {
    const updated = { ...people };
    const id = currentEdit || String(Date.now());
    const parentIds = form.parentId.split(',').map(s => s.trim()).filter(Boolean);
    const existing = updated[id] || { children: [] };
    
    updated[id] = { ...existing, ...form, id, parents: parentIds };
    setPeople(updated);
    setModalOpen(false);
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", color: "#b91c1c", marginBottom: "30px" }}>Batarseh Family Tree</h1>
        
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
           <button onClick={openAdd} style={{ 
             padding: "10px 20px", 
             backgroundColor: "#000", 
             color: "#fff", 
             border: "none", 
             borderRadius: "5px",
             cursor: "pointer",
             fontWeight: "bold"
           }}>
             + Add Family Member
           </button>
        </div>

        {/* The Family Tree Diagram */}
        <div ref={treeRef} style={{ 
          background: "white", 
          padding: "30px", 
          borderRadius: "15px", 
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          minHeight: "300px",
          display: "flex",
          justifyContent: "center"
        }} />

        <div style={{ marginTop: "40px", borderTop: "2px solid #eee", paddingTop: "20px" }}>
          <h3 style={{ color: "#444" }}>Member Database</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {Object.values(people).map(p => (
              <button 
                key={p.id} 
                onClick={() => openEdit(p.id)}
                style={{ 
                  padding: "8px 12px", 
                  background: "#fff", 
                  border: "1px solid #ddd", 
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                ✏️ {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{ background: "white", padding: "30px", width: "350px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "15px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ margin: 0 }}>{currentEdit ? "Edit" : "Add"} Person</h3>

            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="Birth Year" value={form.birth} onChange={e => setForm({ ...form, birth: e.target.value })} style={inputStyle} />
            <input placeholder="Death Year" value={form.death} onChange={e => setForm({ ...form, death: e.target.value })} style={inputStyle} />
            
            <div>
               <label style={{fontSize: "0.8em", color: "#666", display: "block", marginBottom: "5px"}}>Parent IDs (comma separated):</label>
               <input placeholder="e.g. 1, 2" value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button onClick={save} style={{ flex: 1, padding: "10px", background: "#b91c1c", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Save</button>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "10px", background: "#e5e7eb", color: "black", border: "none", borderRadius: "5px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "5px",
  width: "100%",
  boxSizing: "border-box"
};
