import { useEffect, useState, useRef } from 'react';
import mermaid from "mermaid";
import { supabase } from './supabaseClient';
import logo from './logo.png';

export default function FamilyTreeApp() {
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [activeTab, setActiveTab] = useState("parents"); // "parents" or "children"
  
  // Form State
  const [form, setForm] = useState({ 
    name: "", birth: "", death: "", img_url: "", parents: [], spouse: "" 
  });
  const [selectedChildren, setSelectedChildren] = useState([]); // Track children separately

  const treeRef = useRef(null);

  // 1. INITIALIZE MERMAID
  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: false, 
      securityLevel: 'loose', 
      theme: 'base', 
      flowchart: { curve: 'stepAfter' }, 
      themeVariables: { primaryColor: '#ffffff', primaryTextColor: '#000000', primaryBorderColor: '#b91c1c', lineColor: '#555', secondaryColor: '#f4f4f4', tertiaryColor: '#fff' }
    });
  }, []); 

  useEffect(() => { fetchPeople(); }, []);

  async function fetchPeople() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('family_members').select('*');
      if (error) throw error;
      const peopleObject = {};
      data.forEach(person => { peopleObject[person.id] = person; });
      setPeople(peopleObject);
    } catch (error) { console.error("Error loading family:", error.message); } 
    finally { setLoading(false); }
  }

  // Render whenever people change
  useEffect(() => { if (!loading) renderTree(); }, [people, loading]);

  // --- RENDER FUNCTION (The "Crash-Proof" Version) ---
  async function renderTree() {
    if (!treeRef.current || Object.keys(people).length === 0) return;

    // A. STRICT SAFETY FUNCTIONS
    // Forces ID to be "NODE_123" with only letters/numbers
    const safeID = (rawId) => {
        if (!rawId) return "UNKNOWN_ID";
        return "NODE_" + String(rawId).replace(/[^a-zA-Z0-9]/g, "_");
    };

    // Cleans text of any code symbols
    const safeText = (rawText) => {
        if (!rawText) return "";
        return String(rawText).replace(/[#<>;:()"']/g, "").trim();
    };

    let chart = `flowchart TD\n`;
    
    // B. STYLES
    chart += `classDef mainNode fill:#fff,stroke:#b91c1c,stroke-width:2px,color:#000,width:150px;\n`;
    chart += `classDef marriageNode fill:none,stroke:none,width:0,height:0;\n`;
    chart += `linkStyle default stroke:#666,stroke-width:2px;\n`;

    // C. DRAW NODES
    Object.values(people).forEach(p => {
      const id = safeID(p.id);
      const name = safeText(p.name);
      const birth = safeText(p.birth);
      const death = safeText(p.death);
      const imgTag = p.img_url ? `<img src='${p.img_url}' width='50' height='50' style='object-fit:cover; margin-bottom:5px;' /><br/>` : "";
      
      chart += `${id}("${imgTag}<b>${name}</b><br/><span style='font-size:0.8em'>${birth}${death ? ` - ${death}` : ""}</span>"):::mainNode\n`;
    });

// D. DRAW MARRIAGES (Correct Horizontal Alignment)
const knots = {};
const processed = new Set();

Object.values(people).forEach(p => {
  if (!p.spouse || !people[p.spouse]) return;

  const p1 = safeID(p.id);
  const p2 = safeID(p.spouse);

  if (p1 === p2) return;

  const pair = [p1, p2].sort();
  const coupleKey = pair.join("_X_");

  if (processed.has(coupleKey)) return;
  processed.add(coupleKey);

  const knotId = `KNOT_${coupleKey}`;
  knots[coupleKey] = knotId;

  // Invisible marriage node
  chart += `${knotId}{ }:::marriageNode\n`;

  // FORCE left-right alignment
  chart += `${p1} --- ${knotId} --- ${p2}\n`;
});


    // E. LINK CHILDREN
    Object.values(people).forEach(p => {
      if (p.parents && Array.isArray(p.parents) && p.parents.length > 0) {
        let linkedToKnot = false;

        // 1. Try to link to Parents' Marriage Knot
        if (p.parents.length === 2) {
            const par1 = safeID(p.parents[0]);
            const par2 = safeID(p.parents[1]);
            const coupleKey = [par1, par2].sort().join("_X_");
            
            if (knots[coupleKey]) {
                chart += `${knots[coupleKey]} --> ${safeID(p.id)}\n`;
                linkedToKnot = true;
            }
        }

        // 2. Fallback: Link directly to parent
        if (!linkedToKnot) {
            p.parents.forEach(parId => {
               if (people[parId]) {
                   chart += `${safeID(parId)} --> ${safeID(p.id)}\n`;
               }
            });
        }
      }
    });

    treeRef.current.innerHTML = `<pre class="mermaid" style="width: 100%; height: 100%;">${chart}</pre>`;
    try { await mermaid.run({ nodes: treeRef.current.querySelectorAll('.mermaid') }); } 
    catch (error) { console.error("Mermaid Render Error:", error); }
  }

  // --- ACTIONS ---

  function openAdd() {
    setCurrentEdit(null);
    setForm({ name: "", birth: "", death: "", img_url: "", parents: [], spouse: "" });
    setSelectedChildren([]);
    setActiveTab("parents");
    setModalOpen(true);
  }

  function openEdit(id) {
    const p = people[id];
    setCurrentEdit(id);
    setForm({ ...p, parents: p.parents || [], spouse: p.spouse || "" });
    
    // FIND CHILDREN: Look through all people to see who lists THIS person as a parent
    const foundChildren = Object.values(people)
        .filter(child => child.parents && child.parents.includes(id))
        .map(child => child.id);
    
    setSelectedChildren(foundChildren);
    setActiveTab("parents");
    setModalOpen(true);
  }

  // Toggle Parent Checkbox
  function toggleParent(parentId) {
    const currentParents = form.parents || [];
    if (currentParents.includes(parentId)) {
      setForm({ ...form, parents: currentParents.filter(id => id !== parentId) });
    } else {
      setForm({ ...form, parents: [...currentParents, parentId] });
    }
  }

  // Toggle Child Checkbox
  function toggleChild(childId) {
    if (selectedChildren.includes(childId)) {
        setSelectedChildren(selectedChildren.filter(id => id !== childId));
    } else {
        setSelectedChildren([...selectedChildren, childId]);
    }
  }

  // --- SAVE LOGIC ---
  async function save() {
    const personData = { 
      name: form.name, 
      birth: form.birth || null, 
      death: form.death || null, 
      img_url: form.img_url || null, 
      parents: form.parents || [],
      spouse: form.spouse || null
    };
    
    try {
        let savedId = currentEdit;

        // A. Update/Insert the Main Person
        if (currentEdit) {
            await supabase.from('family_members').update(personData).eq('id', currentEdit);
        } else {
            const { data, error } = await supabase.from('family_members').insert([personData]).select();
            if (error) throw error;
            savedId = data[0].id; 
        }

        // B. Update the Children (Reverse Linking)
        const potentialChildren = Object.values(people).filter(p => p.id !== savedId);

        for (const child of potentialChildren) {
            const isSelected = selectedChildren.includes(child.id);
            const currentParents = child.parents || [];
            const hasParent = currentParents.includes(savedId);

            if (isSelected && !hasParent) {
                // ADD RELATIONSHIP
                const newParents = [...currentParents, savedId];
                await supabase.from('family_members').update({ parents: newParents }).eq('id', child.id);
            } else if (!isSelected && hasParent) {
                // REMOVE RELATIONSHIP
                const newParents = currentParents.filter(pid => pid !== savedId);
                await supabase.from('family_members').update({ parents: newParents }).eq('id', child.id);
            }
        }

        await fetchPeople();
        setModalOpen(false);
    } catch (error) {
        alert("Error saving: " + error.message);
    }
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.heroSection}>
        <div style={styles.heroContent}>
            <img src={logo} alt="Logo" style={styles.bigLogo} />
            <h1 style={styles.heroTitle}>The Batarseh Family</h1>
            <p style={styles.heroSubtitle}>Scroll down to explore our history</p>
        </div>
      </div>

      <div style={styles.contentLayer}>
        <div style={styles.contentInner}>
            <div style={styles.actionBar}>
                <span style={styles.memberCount}>{Object.keys(people).length} Members Found</span>
                <button onClick={openAdd} style={styles.addButton}>+ Add Member</button>
            </div>
           <div
  style={{
    width: "100vw",
    marginLeft: "50%",
    transform: "translateX(-50%)"
  }}
>
  <div style={styles.treeContainer}>
    <div ref={treeRef} />
  </div>
</div>
            <div style={styles.databaseSection}>
                <h3 style={styles.sectionTitle}>Family Database</h3>
                <div style={styles.grid}>
                    {Object.values(people).map(p => (
                    <button key={p.id} onClick={() => openEdit(p.id)} style={styles.card}>
                        <div style={styles.cardImgContainer}>
                        {p.img_url ? <img src={p.img_url} style={styles.cardImg} /> : <div style={styles.cardPlaceholder}>{p.name.charAt(0)}</div>}
                        </div>
                        <div style={styles.cardText}>
                        <strong>{p.name}</strong>
                        <span style={styles.cardDates}>{p.birth} {p.death && `- ${p.death}`}</span>
                        </div>
                    </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 20px 0" }}>{currentEdit ? "Edit Profile" : "Add New Member"}</h3>
            
            {/* --- BASIC INFO --- */}
            <label style={styles.label}>Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={styles.input} />
            
            <div style={{display:"flex", gap:"10px"}}>
                <div style={{flex:1}}>
                    <label style={styles.label}>Birth Year</label>
                    <input value={form.birth} onChange={e => setForm({ ...form, birth: e.target.value })} style={styles.input} />
                </div>
                <div style={{flex:1}}>
                    <label style={styles.label}>Death Year</label>
                    <input value={form.death} onChange={e => setForm({ ...form, death: e.target.value })} style={styles.input} />
                </div>
            </div>
            
            <label style={styles.label}>Photo URL</label>
            <input placeholder="https://..." value={form.img_url} onChange={e => setForm({ ...form, img_url: e.target.value })} style={styles.input} />

            <label style={styles.label}>Spouse</label>
            <select 
                value={form.spouse || ""} 
                onChange={e => setForm({ ...form, spouse: e.target.value })} 
                style={styles.input}
            >
                <option value="">No Spouse</option>
                {Object.values(people)
                    .filter(p => p.id !== currentEdit)
                    .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            {/* --- TABS FOR RELATIVES --- */}
            <div style={styles.tabHeader}>
                <button style={activeTab === "parents" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("parents")}>
                    Select Parents
                </button>
                <button style={activeTab === "children" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("children")}>
                    Select Children
                </button>
            </div>

            <div style={styles.listContainer}>
                {/* PARENT LIST */}
                {activeTab === "parents" && Object.values(people).filter(p => p.id !== currentEdit).map(p => (
                     <div key={p.id} style={styles.checkboxRow}>
                       <input 
                            type="checkbox" 
                            checked={(form.parents || []).includes(p.id)} 
                            onChange={() => toggleParent(p.id)} 
                            style={{ marginRight: "10px" }} 
                        />
                       <span>{p.name}</span>
                     </div>
                ))}

                {/* CHILDREN LIST */}
                {activeTab === "children" && Object.values(people).filter(p => p.id !== currentEdit).map(p => (
                     <div key={p.id} style={styles.checkboxRow}>
                       <input 
                            type="checkbox" 
                            checked={selectedChildren.includes(p.id)} 
                            onChange={() => toggleChild(p.id)} 
                            style={{ marginRight: "10px" }} 
                        />
                       <span>{p.name}</span>
                     </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={save} style={styles.saveButton}>Save</button>
              <button onClick={() => setModalOpen(false)} style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageContainer: { fontFamily: "'Georgia', 'Times New Roman', serif", minHeight: "100vh", backgroundColor: "#f4f1ea" },
  heroSection: { position: "fixed", top: 0, left: 0, width: "100%", height: "90vh", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0, backgroundColor: "#f4f1ea", textAlign: "center" },
  heroContent: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px" },
  bigLogo: { maxWidth: "95vw", maxHeight: "75vh", width: "auto", height: "auto", objectFit: "contain" },
  heroTitle: { fontSize: "2.5em", fontWeight: "normal", margin: "10px 0 5px 0", letterSpacing: "2px", color: "#b91c1c" },
  heroSubtitle: { fontSize: "1.2em", fontStyle: "italic", color: "#b91c1c", opacity: 0.8 },
  contentLayer: { position: "relative", zIndex: 10, marginTop: "85vh", backgroundColor: "#f4f1ea", minHeight: "100vh", boxShadow: "0 -10px 30px rgba(185, 28, 28, 0.1)", borderTopLeftRadius: "30px", borderTopRightRadius: "30px", paddingBottom: "100px" },
contentInner: {
  maxWidth: "none",        // ✅ remove cap
  width: "100%",
  padding: "40px 20px"
},
  actionBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  addButton: { padding: "10px 20px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: "30px", cursor: "pointer", fontWeight: "bold" },
  memberCount: { color: "#b91c1c", fontStyle: "italic" },
treeContainer: {
  position: "relative",
  height: "90vh",
  overflow: "hidden",   // important for panning later
  background: "#fafafa",
  cursor: "grab",
  borderRadius: "10px",
  border: "1px solid #e5e7eb"
},


  databaseSection: { marginTop: "50px" },
  sectionTitle: { borderBottom: "2px solid #b91c1c", display: "inline-block", paddingBottom: "5px", marginBottom: "20px", color: "#b91c1c" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" },
  card: { display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "white", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", textAlign: "left" },
  cardImgContainer: { width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#eee" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover" },
  cardPlaceholder: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: "bold" },
  cardText: { display: "flex", flexDirection: "column" },
  cardDates: { fontSize: "0.8em", color: "#777" },
  
  // MODAL STYLES
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "white", padding: "30px", width: "450px", borderRadius: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "90vh", overflowY: "auto" },
  input: { padding: "10px", border: "1px solid #ccc", borderRadius: "5px", width: "100%", boxSizing: "border-box", marginBottom:"5px" },
  label: { fontSize: "0.8em", fontWeight: "bold", color: "#555", display: "block", marginTop: "5px" },
  
  // TAB STYLES
  tabHeader: { display: "flex", gap: "5px", marginTop: "10px", borderBottom: "1px solid #ccc" },
  tab: { flex: 1, padding: "8px", cursor: "pointer", background: "#f9f9f9", border: "1px solid #ccc", borderBottom: "none", borderRadius: "5px 5px 0 0", color: "#666" },
  activeTab: { flex: 1, padding: "8px", cursor: "pointer", background: "#fff", border: "1px solid #b91c1c", borderBottom: "1px solid #fff", borderRadius: "5px 5px 0 0", fontWeight: "bold", color: "#b91c1c", marginBottom: "-1px" },
  
  listContainer: { border: "1px solid #ccc", padding: "10px", borderRadius: "0 0 5px 5px", maxHeight: "150px", overflowY: "auto", background: "#fcfcfc" },
  checkboxRow: { display: "flex", alignItems: "center", marginBottom: "5px", padding: "5px", borderBottom: "1px solid #eee" },
  
  saveButton: { flex: 1, padding: "10px", background: "#b91c1c", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" },
  cancelButton: { flex: 1, padding: "10px", background: "#eee", color: "black", border: "none", borderRadius: "5px", cursor: "pointer" }
};
