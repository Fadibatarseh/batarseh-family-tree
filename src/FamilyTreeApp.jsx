import { useEffect, useState, useRef } from 'react';
import mermaid from "mermaid";
import { supabase } from './supabaseClient';
import logo from './logo.png';

export default function FamilyTreeApp() {
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [currentEdit, setCurrentEdit] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  // UPDATED: Added spouse to the initial state
  const [form, setForm] = useState({ name: "", birth: "", death: "", img_url: "", parents: [], spouse: "" });
  const treeRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: false, securityLevel: 'loose', theme: 'base', flowchart: { curve: 'stepAfter' },
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

  useEffect(() => { if (!loading) renderTree(); }, [people, loading]);

// UPDATED: renderTree with "Marriage Knots" for perfect alignment
  async function renderTree() {
    if (!treeRef.current || Object.keys(people).length === 0) return;
    
    // We use "ortho" (orthogonal) lines for neat right-angles
    let chart = `flowchart TD\n`;
    
    // STYLE DEFINITIONS
    // 1. People: Rectangular boxes
    chart += `classDef mainNode fill:#fff,stroke:#b91c1c,stroke-width:2px,color:#000,width:150px;\n`;
    // 2. The Knot: A tiny black dot to represent marriage
    chart += `classDef marriageNode width:10px,height:10px,fill:#000,stroke:none,color:transparent;\n`;
    
    // Set curve style to Step for neat T-shaped family lines
    mermaid.initialize({ flowchart: { curve: 'stepAfter' } }); 

    // 1. Draw All People Nodes First
    Object.values(people).forEach(p => {
      const safeName = p.name.replace(/"/g, "'");
      const imgTag = p.img_url ? `<img src='${p.img_url}' width='50' height='50' style='object-fit:cover; margin-bottom:5px;' /><br/>` : "";
      chart += `${p.id}("${imgTag}<b>${safeName}</b><br/><span style='font-size:0.8em'>${p.birth}${p.death ? ` - ${p.death}` : ""}</span>"):::mainNode\n`;
    });

    // 2. Create "Marriage Knots" & Link Spouses
    const knots = {}; // Store created knots to reuse them
    
    Object.values(people).forEach(p => {
      if (p.spouse && people[p.spouse]) {
        // Create a unique ID for the couple (sort IDs so A-B is same as B-A)
        const coupleKey = [p.id, p.spouse].sort().join("-");
        
        // If we haven't processed this couple yet...
        if (!knots[coupleKey]) {
           const knotId = `union${coupleKey.replace(/-/g, '')}`; // e.g., unionJohnJane
           knots[coupleKey] = knotId;
           
           // Draw the Knot (Small Dot)
           chart += `${knotId}( ) :::marriageNode\n`;
           
           // Link Parents to the Knot: Parent1 --- Knot --- Parent2
           chart += `${p.id} --- ${knotId} --- ${p.spouse}\n`;
        }
      }
    });

    // 3. Link Children to Parents (or Knots)
    Object.values(people).forEach(p => {
      if (p.parents && p.parents.length > 0) {
        let linkedToKnot = false;

        // If child has exactly 2 parents, check if they are married (have a Knot)
        if (p.parents.length === 2) {
            const coupleKey = [...p.parents].sort().join("-");
            if (knots[coupleKey]) {
                // Perfect Match: Link the KNOT to the child
                // This creates the clean "T" shape
                chart += `${knots[coupleKey]} --> ${p.id}\n`;
                linkedToKnot = true;
            }
        }

        // Fallback: If parents aren't married (or single parent), link directly
        if (!linkedToKnot) {
            p.parents.forEach(parId => {
               if (people[parId]) chart += `${parId} --> ${p.id}\n`;
            });
        }
      }
    });

    treeRef.current.innerHTML = `<pre class="mermaid" style="width: 100%; height: 100%;">${chart}</pre>`;
    try { await mermaid.run({ nodes: treeRef.current.querySelectorAll('.mermaid') }); } 
    catch (error) { console.error("Mermaid Render Error:", error); }
  }

    treeRef.current.innerHTML = `<pre class="mermaid" style="width: 100%; height: 100%;">${chart}</pre>`;
    try { await mermaid.run({ nodes: treeRef.current.querySelectorAll('.mermaid') }); } 
    catch (error) { console.error("Mermaid Render Error:", error); }
  }

  function openEdit(id) {
    const p = people[id];
    setCurrentEdit(id);
    setForm({ ...p, parents: p.parents || [], spouse: p.spouse || "" });
    setModalOpen(true);
  }

  function openAdd() {
    setCurrentEdit(null);
    setForm({ name: "", birth: "", death: "", img_url: "", parents: [], spouse: "" });
    setModalOpen(true);
  }

  function toggleParent(parentId) {
    const currentParents = form.parents || [];
    if (currentParents.includes(parentId)) {
      setForm({ ...form, parents: currentParents.filter(id => id !== parentId) });
    } else {
      setForm({ ...form, parents: [...currentParents, parentId] });
    }
  }

  // UPDATED: Save function handling empty strings and spouse
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
        if (currentEdit) {
            await supabase.from('family_members').update(personData).eq('id', currentEdit);
        } else {
            await supabase.from('family_members').insert([personData]);
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
            <div style={styles.treeContainer}>
                {loading ? <p style={{textAlign:"center", padding:20}}>Loading...</p> : <div ref={treeRef} />}
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

            {/* NEW SPOUSE SELECTOR */}
            <label style={styles.label}>Spouse (Optional)</label>
            <select 
                value={form.spouse || ""} 
                onChange={e => setForm({ ...form, spouse: e.target.value })} 
                style={styles.input}
            >
                <option value="">No Spouse / Unknown</option>
                {Object.values(people)
                    .filter(p => p.id !== currentEdit)
                    .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            <div>
               <label style={styles.label}>Parents:</label>
               <div style={styles.parentList}>
                 {Object.values(people).filter(p => p.id !== currentEdit).map(p => (
                     <div key={p.id} style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                       <input type="checkbox" checked={(form.parents || []).includes(p.id)} onChange={() => toggleParent(p.id)} style={{ marginRight: "10px" }} />
                       <span>{p.name}</span>
                     </div>
                   ))}
               </div>
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
  contentInner: { maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" },
  actionBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  addButton: { padding: "10px 20px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: "30px", cursor: "pointer", fontWeight: "bold" },
  memberCount: { color: "#b91c1c", fontStyle: "italic" },
  treeContainer: { background: "white", borderRadius: "10px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", padding: "20px", minHeight: "400px", overflow: "auto", border: "1px solid #e5e7eb" },
  databaseSection: { marginTop: "50px" },
  sectionTitle: { borderBottom: "2px solid #b91c1c", display: "inline-block", paddingBottom: "5px", marginBottom: "20px", color: "#b91c1c" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" },
  card: { display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "white", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", textAlign: "left" },
  cardImgContainer: { width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#eee" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover" },
  cardPlaceholder: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: "bold" },
  cardText: { display: "flex", flexDirection: "column" },
  cardDates: { fontSize: "0.8em", color: "#777" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "white", padding: "30px", width: "400px", borderRadius: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "15px", maxHeight: "90vh", overflowY: "auto" },
  input: { padding: "10px", border: "1px solid #ccc", borderRadius: "5px", width: "100%", boxSizing: "border-box" },
  label: { fontSize: "0.8em", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" },
  parentList: { border: "1px solid #ccc", padding: "10px", borderRadius: "5px", maxHeight: "150px", overflowY: "auto", background: "#f9f9f9" },
  saveButton: { flex: 1, padding: "10px", background: "#b91c1c", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" },
  cancelButton: { flex: 1, padding: "10px", background: "#eee", color: "black", border: "none", borderRadius: "5px", cursor: "pointer" }
};
