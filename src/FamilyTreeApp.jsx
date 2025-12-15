import { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";
import { supabase } from "./supabaseClient";
import logo from "./logo.png";

/* ------------------------- UTILITIES ------------------------- */
const safeID = (id) => "NODE_" + String(id).replace(/[^a-zA-Z0-9]/g, "_");
const safeText = (t) => (t ? String(t).replace(/[#<>;:()"']/g, "") : "");

/* ------------------------- COMPONENT ------------------------- */
export default function FamilyTreeApp() {
  /* ------------------------- DATA STATE ------------------------- */
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // Search Bar State

  /* ------------------------- MODAL STATE ------------------------- */
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [activeTab, setActiveTab] = useState("parents"); // Tabs: "parents" or "children"

  const [form, setForm] = useState({
    name: "",
    birth: "",
    death: "",
    img_url: "",
    parents: [],
    spouse: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState([]); // Track children links

  /* ------------------------- REFS ------------------------- */
  const treeRef = useRef(null);
  const viewportRef = useRef(null);
  
  // Custom Pan/Zoom State
  const panZoom = useRef(
    JSON.parse(localStorage.getItem("tree_view")) || { x: 0, y: 0, scale: 1 }
  );
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  /* ------------------------- INITIALIZATION ------------------------- */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      flowchart: { curve: "stepAfter", nodeSpacing: 80, rankSpacing: 120 },
    });
  }, []);

  // Make nodes clickable globally
  useEffect(() => {
    window.onNodeClick = (id) => {
      openEdit(id);
    };
  }, [people]);

  /* ------------------------- LOAD DATA ------------------------- */
  useEffect(() => {
    fetchPeople();
  }, []);

  async function fetchPeople() {
    setLoading(true);
    const { data, error } = await supabase.from("family_members").select("*");
    if (!error) {
      const obj = {};
      data.forEach((p) => (obj[p.id] = p));
      setPeople(obj);
    }
    setLoading(false);
  }

  /* ------------------------- RENDER TREE ------------------------- */
  useEffect(() => {
    if (!loading) renderTree();
  }, [people, loading]);

 async function renderTree() {
    if (!treeRef.current) return;

    let chart = "flowchart TD\n";
    
    // 1. STYLES
    // Main Node: The Person
    chart += "classDef main fill:#fff,stroke:#b91c1c,stroke-width:2px,cursor:pointer,rx:5,ry:5;\n";
    // Family Node: A tiny invisible dot that connects parents and children
    chart += "classDef familyNode width:0px,height:0px,padding:0px,stroke:none,fill:#000;\n";
    // Link Styles: Smooth curves
    chart += "linkStyle default stroke:#666,stroke-width:2px,fill:none;\n";

    // 2. DRAW PEOPLE (The Nodes)
    Object.values(people).forEach((p) => {
      // Draw the person
      chart += `${safeID(p.id)}("${safeText(p.name)}<br/>${safeText(p.birth)}${
        p.death ? " - " + safeText(p.death) : ""
      }"):::main\n`;
      
      // Add Click Event
      chart += `click ${safeID(p.id)} call window.onNodeClick("${p.id}")\n`;
    });

    // 3. DRAW RELATIONSHIPS (The Family Hub Method)
    // We group children by their parent pairs to create "Family Nodes"
    const families = {};

    Object.values(people).forEach((child) => {
      if (child.parents && child.parents.length > 0) {
        // Create a unique key for the parents (e.g., "MOM_ID+DAD_ID")
        // If single parent, just "MOM_ID"
        const parentsKey = [...child.parents].sort().join("_X_");
        
        if (!families[parentsKey]) {
            families[parentsKey] = {
                id: `FAM_${parentsKey}`, // The invisible dot ID
                parents: child.parents,
                children: []
            };
        }
        families[parentsKey].children.push(child.id);
      }
    });

    // 4. GENERATE THE LINES
    Object.values(families).forEach((fam) => {
        // Draw the invisible Family Dot
        chart += `${fam.id}[ ]:::familyNode\n`; // [ ] is an empty label

        // Link Parents -> Family Dot
        fam.parents.forEach(parentId => {
            if (people[parentId]) {
                chart += `${safeID(parentId)} --- ${fam.id}\n`;
            }
        });

        // Link Family Dot -> Children
        fam.children.forEach(childId => {
            chart += `${fam.id} --> ${safeID(childId)}\n`;
        });
    });

    // 5. HANDLE "CHILDLESS COUPLES" (Spouses with no kids yet)
    // We manually check for spouses who aren't in the 'families' list above
    const processedSpouses = new Set();
    Object.values(people).forEach(p => {
        if(p.spouse && people[p.spouse]) {
            const p1 = p.id;
            const p2 = p.spouse;
            const pairKey = [p1, p2].sort().join("_X_");
            
            // If this couple hasn't been processed via children logic above
            if (!families[pairKey] && !processedSpouses.has(pairKey)) {
                const famId = `FAM_COUPLE_${pairKey}`;
                // Draw invisible connector
                chart += `${famId}[ ]:::familyNode\n`;
                // Link both to connector
                chart += `${safeID(p1)} --- ${famId} --- ${safeID(p2)}\n`;
                
                processedSpouses.add(pairKey);
            }
        }
    });

    treeRef.current.innerHTML = `<pre class="mermaid">${chart}</pre>`;
    try {
        await mermaid.run({ nodes: treeRef.current.querySelectorAll(".mermaid") });
        applyTransform();
    } catch (e) {
        console.error("Mermaid Render Error", e);
    }
  }

  /* ------------------------- PAN / ZOOM LOGIC ------------------------- */
  function applyTransform() {
    const el = treeRef.current;
    if (!el) return;
    const { x, y, scale } = panZoom.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    el.style.transformOrigin = "0 0";
    localStorage.setItem("tree_view", JSON.stringify(panZoom.current));
  }

  // Handle Zoom (Mouse Wheel)
  function onWheel(e) {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const newScale = Math.min(3, Math.max(0.2, panZoom.current.scale - e.deltaY * zoomSpeed));
    panZoom.current.scale = newScale;
    applyTransform();
  }

  // Handle Drag Start
  function startDrag(e) {
    isDragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    lastMouse.current = { x: clientX, y: clientY };
  }

  // Handle Drag Move (Mouse + Touch)
  function onDrag(e) {
    if (!isDragging.current) return;
    
    // Prevent default scrolling on mobile to allow dragging
    if(e.touches) e.preventDefault(); 

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - lastMouse.current.x;
    const deltaY = clientY - lastMouse.current.y;

    panZoom.current.x += deltaX;
    panZoom.current.y += deltaY;

    lastMouse.current = { x: clientX, y: clientY };
    applyTransform();
  }

  function stopDrag() {
    isDragging.current = false;
  }

  /* ------------------------- ACTIONS ------------------------- */
  function openAdd() {
    setCurrentEdit(null);
    setForm({ name: "", birth: "", death: "", img_url: "", parents: [], spouse: "" });
    setSelectedChildren([]);
    setImageFile(null);
    setActiveTab("parents");
    setModalOpen(true);
    setSearchTerm(""); // Close search results
  }

  function openEdit(id) {
    const p = people[id];
    setCurrentEdit(id);
    setForm({ ...p, parents: p.parents || [], spouse: p.spouse || "" });
    
    // Find children
    setSelectedChildren(
      Object.values(people)
        .filter((c) => c.parents?.includes(id))
        .map((c) => c.id)
    );
    
    setImageFile(null);
    setActiveTab("parents");
    setModalOpen(true);
    setSearchTerm(""); // Close search results
  }

  // Handle Checkboxes
  function toggleParent(pid) {
    const current = form.parents || [];
    setForm({
      ...form,
      parents: current.includes(pid)
        ? current.filter((id) => id !== pid)
        : [...current, pid],
    });
  }

  function toggleChild(cid) {
    setSelectedChildren((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    );
  }

  async function uploadImage(file, personId) {
    if (!file) return null;
    const fileExt = file.name.split(".").pop();
    const filePath = `person-${personId}.${fileExt}`;
    const { error } = await supabase.storage.from("family-photos").upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("family-photos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  // --- SAVE FUNCTION (UPDATED) ---
  async function save() {
    try {
      let savedId = currentEdit;
      
      // 1. Save Main Person
      const personData = {
        name: form.name,
        birth: form.birth || null,
        death: form.death || null,
        parents: form.parents || [],
        spouse: form.spouse || null,
      };

      if (currentEdit) {
        await supabase.from("family_members").update(personData).eq("id", currentEdit);
      } else {
        const { data, error } = await supabase.from("family_members").insert([personData]).select();
        if (error) throw error;
        savedId = data[0].id;
      }

      // 2. Upload Image
      if (imageFile && savedId) {
        const imageUrl = await uploadImage(imageFile, savedId);
        await supabase.from("family_members").update({ img_url: imageUrl }).eq("id", savedId);
      }

      // 3. Update Children (Bi-directional Link)
      const allPeople = Object.values(people).filter(p => p.id !== savedId);
      
      for (const child of allPeople) {
        const isSelected = selectedChildren.includes(child.id);
        const currentParents = child.parents || [];
        const hasParent = currentParents.includes(savedId);

        if (isSelected && !hasParent) {
          await supabase.from("family_members").update({ parents: [...currentParents, savedId] }).eq("id", child.id);
        } else if (!isSelected && hasParent) {
          await supabase.from("family_members").update({ parents: currentParents.filter(pid => pid !== savedId) }).eq("id", child.id);
        }
      }

      setModalOpen(false);
      fetchPeople();
    } catch (error) {
      alert("Save failed: " + error.message);
    }
  }

  /* ------------------------- UI RENDER ------------------------- */
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      
      {/* HEADER BAR */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={logo} alt="Logo" height={40} />
          
          {/* SEARCH BAR */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Search family..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            {/* SEARCH RESULTS DROPDOWN */}
            {searchTerm && (
                <div style={styles.searchResults}>
                    {Object.values(people)
                        .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(p => (
                            <div key={p.id} onClick={() => openEdit(p.id)} style={styles.searchItem}>
                                {p.name}
                            </div>
                        ))
                    }
                    {Object.values(people).filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                        <div style={{padding:10, color:"#999"}}>No results</div>
                    )}
                </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
           {/* REFOCUS BUTTON */}
           <button 
             onClick={() => { panZoom.current = { x: 0, y: 0, scale: 1 }; applyTransform(); }} 
             style={styles.secondaryBtn}
           >
             Refocus View
           </button>

           <button onClick={openAdd} style={styles.primaryBtn}>
             + Add Member
           </button>
        </div>
      </header>

      {/* TREE CANVAS */}
      <div
        ref={viewportRef}
        onWheel={onWheel}
        onMouseDown={startDrag}
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={startDrag} // Mobile Touch
        onTouchMove={onDrag}     // Mobile Touch
        onTouchEnd={stopDrag}    // Mobile Touch
        style={styles.viewport}
      >
        <div ref={treeRef} style={{ transformOrigin: "0 0" }} />
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3>{currentEdit ? "Edit Profile" : "Add New Member"}</h3>

            <label style={styles.label}>Full Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={styles.input}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Birth Year</label>
                <input
                  value={form.birth}
                  onChange={(e) => setForm({ ...form, birth: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Death Year</label>
                <input
                  value={form.death}
                  onChange={(e) => setForm({ ...form, death: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <label style={styles.label}>Spouse</label>
            <select
                value={form.spouse || ""}
                onChange={(e) => setForm({ ...form, spouse: e.target.value })}
                style={styles.input}
            >
                <option value="">No Spouse</option>
                {Object.values(people)
                   .filter(p => p.id !== currentEdit)
                   .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                }
            </select>

            <label style={styles.label}>Upload Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              style={{ marginBottom: 10 }}
            />
            {form.img_url && (
              <img src={form.img_url} alt="Preview" style={styles.previewImg} />
            )}

            {/* --- RELATIVES TABS --- */}
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

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button onClick={save} style={styles.primaryBtn}>Save</button>
              <button onClick={() => setModalOpen(false)} style={styles.secondaryBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- STYLES ------------------------- */
const styles = {
    header: { padding: "10px 20px", borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", zIndex: 10 },
    searchInput: { padding: "8px", borderRadius: "20px", border: "1px solid #ccc", width: "250px", paddingLeft: "15px" },
    searchResults: { position: "absolute", top: "40px", left: 0, width: "100%", background: "white", border: "1px solid #ccc", borderRadius: "5px", maxHeight: "200px", overflowY: "auto", boxShadow: "0 5px 15px rgba(0,0,0,0.1)", zIndex: 100 },
    searchItem: { padding: "10px", borderBottom: "1px solid #eee", cursor: "pointer" },
    viewport: { flex: 1, overflow: "hidden", cursor: "grab", background: "#fafafa", touchAction: "none" },
    modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modalBox: { background: "white", padding: "30px", width: "450px", borderRadius: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "90vh", overflowY: "auto" },
    input: { padding: "10px", border: "1px solid #ccc", borderRadius: "5px", width: "100%", boxSizing: "border-box" },
    label: { fontSize: "0.85em", fontWeight: "bold", color: "#555", marginTop: "10px" },
    primaryBtn: { padding: "10px 20px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" },
    secondaryBtn: { padding: "10px 20px", background: "#eee", color: "#333", border: "none", borderRadius: "5px", cursor: "pointer" },
    previewImg: { width: 80, height: 80, objectFit: "cover", borderRadius: "5px", marginTop: 5 },
    
    // Tabs
    tabHeader: { display: "flex", gap: "5px", marginTop: "15px", borderBottom: "1px solid #ccc" },
    tab: { flex: 1, padding: "8px", cursor: "pointer", background: "#f9f9f9", border: "1px solid #ccc", borderBottom: "none", borderRadius: "5px 5px 0 0", color: "#666" },
    activeTab: { flex: 1, padding: "8px", cursor: "pointer", background: "#fff", border: "1px solid #b91c1c", borderBottom: "1px solid #fff", borderRadius: "5px 5px 0 0", fontWeight: "bold", color: "#b91c1c", marginBottom: "-1px" },
    listContainer: { border: "1px solid #ccc", padding: "10px", borderRadius: "0 0 5px 5px", maxHeight: "150px", overflowY: "auto", background: "#fcfcfc" },
    checkboxRow: { display: "flex", alignItems: "center", marginBottom: "5px", padding: "5px", borderBottom: "1px solid #eee" },
};
