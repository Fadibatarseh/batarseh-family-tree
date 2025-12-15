import { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";
import { supabase } from "./supabaseClient";
import logo from "./logo.png";

/* ------------------------- UTILITIES ------------------------- */
const safeID = (id) => "NODE_" + String(id).replace(/[^a-zA-Z0-9]/g, "_");
const safeText = (t) => (t ? String(t).replace(/[#<>;:()"']/g, "") : "");

/* ------------------------- COMPONENT ------------------------- */
export default function FamilyTreeApp() {
  /* ------------------------- DATA ------------------------- */
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);

  /* ------------------------- MODAL ------------------------- */
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [activeTab, setActiveTab] = useState("parents");

  const [form, setForm] = useState({
    name: "",
    birth: "",
    death: "",
    img_url: "",
    parents: [],
    spouse: "",
  });

  const [imageFile, setImageFile] = useState(null);

  const [selectedChildren, setSelectedChildren] = useState([]);

  /* ------------------------- REFS ------------------------- */
  const treeRef = useRef(null);
  const viewportRef = useRef(null);

  /* ------------------------- PAN / ZOOM ------------------------- */
  const panZoom = useRef(
    JSON.parse(localStorage.getItem("tree_view")) || {
      x: 0,
      y: 0,
      scale: 1,
    }
  );

  /* ------------------------- MERMAID INIT ------------------------- */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      flowchart: { curve: "stepAfter", nodeSpacing: 80, rankSpacing: 120 },
    });
  }, []);

  /* ------------------------- LOAD DATA ------------------------- */
  useEffect(() => {
    fetchPeople();
  }, []);

  async function fetchPeople() {
    setLoading(true);
    const { data, error } = await supabase
      .from("family_members")
      .select("*");
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
    chart += "classDef main fill:#fff,stroke:#b91c1c,stroke-width:2px;\n";
    chart += "classDef knot width:0,height:0,fill:none,stroke:none;\n";

    const knots = {};

    Object.values(people).forEach((p) => {
      chart += `${safeID(p.id)}("${safeText(p.name)}<br/>${safeText(
        p.birth
      )}${p.death ? " - " + safeText(p.death) : ""}"):::main\n`;
    });

    Object.values(people).forEach((p) => {
      if (p.spouse && people[p.spouse]) {
        const pair = [p.id, p.spouse].sort();
        const key = pair.join("_");
        if (!knots[key]) {
          knots[key] = `KNOT_${key}`;
          chart += `${safeID(pair[0])} --- ${knots[key]} --- ${safeID(
            pair[1]
          )}\n`;
          chart += `${knots[key]}{ }:::knot\n`;
        }
      }
    });

    Object.values(people).forEach((p) => {
      if (p.parents?.length === 2) {
        const key = [...p.parents].sort().join("_");
        if (knots[key]) {
          chart += `${knots[key]} --> ${safeID(p.id)}\n`;
          return;
        }
      }
      p.parents?.forEach((pid) => {
        if (people[pid]) chart += `${safeID(pid)} --> ${safeID(p.id)}\n`;
      });
    });

    treeRef.current.innerHTML = `<pre class="mermaid">${chart}</pre>`;
    await mermaid.run({ nodes: treeRef.current.querySelectorAll(".mermaid") });
    applyTransform();
  }

  /* ------------------------- PAN / ZOOM HANDLERS ------------------------- */
  function applyTransform() {
    const el = treeRef.current;
    if (!el) return;
    const { x, y, scale } = panZoom.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    localStorage.setItem("tree_view", JSON.stringify(panZoom.current));
  }

  function onWheel(e) {
    e.preventDefault();
    panZoom.current.scale = Math.min(
      2,
      Math.max(0.3, panZoom.current.scale - e.deltaY * 0.001)
    );
    applyTransform();
  }

  function onDrag(e) {
    if (!e.buttons) return;
    panZoom.current.x += e.movementX;
    panZoom.current.y += e.movementY;
    applyTransform();
  }

  /* ------------------------- ADD / EDIT ------------------------- */
  function openAdd() {
    setCurrentEdit(null);
    setForm({
      name: "",
      birth: "",
      death: "",
      img_url: "",
      parents: [],
      spouse: "",
    });
    setSelectedChildren([]);
    setImageFile(null);
    setModalOpen(true);
  }

  function openEdit(id) {
    const p = people[id];
    setCurrentEdit(id);
    setForm({ ...p, parents: p.parents || [] });
    setSelectedChildren(
      Object.values(people)
        .filter((c) => c.parents?.includes(id))
        .map((c) => c.id)
    );
    setImageFile(null);
    setModalOpen(true);
  }
  
async function uploadImage(file, personId) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const filePath = `person-${personId}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("family-photos")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    alert("Image upload failed");
    throw uploadError;
  }

  const { data } = supabase.storage
    .from("family-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function save() {
  try {
    let savedId = currentEdit;

    if (currentEdit) {
      await supabase
        .from("family_members")
        .update({
          name: form.name,
          birth: form.birth || null,
          death: form.death || null,
          parents: form.parents || [],
          spouse: form.spouse || null,
        })
        .eq("id", currentEdit);
    } else {
      const { data, error } = await supabase
        .from("family_members")
        .insert([
          {
            name: form.name,
            birth: form.birth || null,
            death: form.death || null,
            parents: form.parents || [],
            spouse: form.spouse || null,
          },
        ])
        .select();

      if (error) throw error;
      savedId = data[0].id;
    }

    if (imageFile && savedId) {
      const imageUrl = await uploadImage(imageFile, savedId);
      await supabase
        .from("family_members")
        .update({ img_url: imageUrl })
        .eq("id", savedId);
    }

    setModalOpen(false);
    fetchPeople();
  } catch (error) {
    alert("Save failed: " + error.message);
  }
}


  /* ------------------------- UI ------------------------- */
return (
  <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    {/* HEADER */}
    <header style={{ padding: "10px 20px", borderBottom: "1px solid #ddd" }}>
      <img src={logo} alt="Logo" height={40} />
      <button onClick={openAdd} style={{ marginLeft: 20 }}>
        ➕ Add Member
      </button>
    </header>

    {/* TREE VIEW */}
    <div
      ref={viewportRef}
      onWheel={onWheel}
      onMouseMove={onDrag}
      style={{
        flex: 1,
        overflow: "hidden",
        cursor: "grab",
        background: "#fafafa",
      }}
    >
      <div ref={treeRef} />
    </div>

    {/* MODAL */}
    {modalOpen && (
      <div style={styles.modalOverlay}>
        <div style={styles.modalBox}>
          <h3>{currentEdit ? "Edit Profile" : "Add New Member"}</h3>

          <label style={styles.label}>Full Name</label>
          <input
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            style={styles.input}
          />

          <label style={styles.label}>Birth Year</label>
          <input
            value={form.birth}
            onChange={(e) =>
              setForm({ ...form, birth: e.target.value })
            }
            style={styles.input}
          />

          <label style={styles.label}>Death Year</label>
          <input
            value={form.death}
            onChange={(e) =>
              setForm({ ...form, death: e.target.value })
            }
            style={styles.input}
          />

          <label style={styles.label}>Upload Photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
          />

          {form.img_url && (
            <img
              src={form.img_url}
              alt="Preview"
              style={{
                width: 80,
                height: 80,
                objectFit: "cover",
                marginTop: 10,
              }}
            />
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button onClick={save}>Save</button>
            <button onClick={() => setModalOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
