(function () {
  const fileInput = document.getElementById("file");
  const selectBtn = document.getElementById("selectBtn");
  const exampleBtn = document.getElementById("exampleBtn");
  const drop = document.getElementById("drop");
  const previewWrap = document.getElementById("previewWrap");
  const preview = document.getElementById("preview");
  const filenameEl = document.getElementById("filename");
  const filesizeEl = document.getElementById("filesize");
  const langSel = document.getElementById("lang");
  const psmSingle = document.getElementById("psmSingle");
  const runBtn = document.getElementById("runBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");
  const saveBtn = document.getElementById("saveBtn");
  const output = document.getElementById("output");
  const bar = document.getElementById("bar");
  const status = document.getElementById("status");
  const errEl = document.getElementById("err");
  const infoChips = document.getElementById("infoChips");

  let currentImageBlob = null;

  function bytes(n) {
    if (!Number.isFinite(n)) return "—";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    return n.toFixed(i ? 1 : 0) + " " + u[i];
  }

  function setStatus(msg) {
    status.textContent = msg;
  }
  function setError(msg) {
    errEl.style.display = msg ? "block" : "none";
    errEl.textContent = msg || "";
  }
  function setProgress(p) {
    bar.style.width = Math.max(0, Math.min(100, p || 0)) + "%";
  }

  function showPreview(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.onload = () => URL.revokeObjectURL(url);
    previewWrap.style.display = "block";
    filenameEl.textContent = file.name || "pasted-image.png";
    filesizeEl.textContent = bytes(file.size || 0);
    currentImageBlob = file;
    setStatus("Image loaded. Ready to run OCR.");
    setError("");
    setProgress(0);
    infoChips.innerHTML = "";
  }

  function handleFiles(files) {
    if (!files || !files.length) {
      return;
    }
    const f = files[0];
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    showPreview(f);
  }

  function extractNameFromCertificate(text) {
    text = text.replace(/\s+/g, ' ').trim();

    const beforeKeywords = [
        "certify that",
        "awarded to",
        "presented to",
        "holder",
        "name:"
    ];
    const afterKeywords = [
        "successfully",
        "successfully completed",
        "has successfully",
        "for completing",
        "in recognition",
        "certificate of"
    ];

    let name = null;

    for (let before of beforeKeywords) {
        const idx = text.toLowerCase().indexOf(before);
        if (idx !== -1) {
        let candidate = text.substring(idx + before.length).trim();
        for (let after of afterKeywords) {
            const endIdx = candidate.toLowerCase().indexOf(after);
            if (endIdx !== -1) {
            candidate = candidate.substring(0, endIdx).trim();
            }
        }
        name = candidate.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        break;
        }
    }

    return name || "Name not found";
    }



  //Upload
  selectBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  //drag and drop
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
    })
  );
  drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  // paste
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.indexOf("image") === 0) {
        const f = it.getAsFile();
        if (f) showPreview(f);
      }
    }
  });

  // Sample image
  const sampleDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAyAAAAEICAYAAAB4kF7OAAAACXBIWXMAAAsSAAALEgHS3X78AAAgAElEQVR4nO3dwY3kOBQF0Jz//5r3mJ3l0mJg9lI1qg0S1R0Hk2m7vQnJrF0w3a0x8F0y1y8c1\
      4yWc9c0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMD/0mT3GmFQ\
      ...";

  function makeSampleCanvas() {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 400;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 64px system-ui,Segoe UI,Roboto";
    ctx.fillText("Hello OCR — नमस्ते", 48, 140);
    ctx.font = "48px system-ui,Segoe UI,Roboto";
    ctx.fillText("Drop an image or click Upload.", 48, 240);
    ctx.fillText("High contrast = best accuracy.", 48, 320);
    return c;
  }

  exampleBtn.addEventListener("click", async () => {
    const c = makeSampleCanvas();
    c.toBlob((b) => {
      if (!b) return;
      const f = new File([b], "sample.png", { type: "image/png" });
      showPreview(f);
    });
  });

  // OCR
  runBtn.addEventListener("click", async () => {
    if (!currentImageBlob) {
      setError("Please upload an image first.");
      return;
    }
    setError("");
    setProgress(1);
    setStatus("Loading OCR engine…");

    try {
      const lang = langSel.value || "eng";
      const psm = psmSingle.checked ? 7 : 3; //

      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress != null) {
            setProgress(Math.round(m.progress * 100));
            setStatus("Recognizing… " + Math.round(m.progress * 100) + "%");
          } else if (m.status) {
            setStatus(m.status.replace(/\b\w/g, (ch) => ch.toUpperCase()));
          }
        },
      });

      await worker.setParameters({ tessedit_pageseg_mode: String(psm) });

      const { data } = await worker.recognize(currentImageBlob);
      output.value = data.text || "";

      infoChips.innerHTML = "";
      const make = (label) => {
        const s = document.createElement("span");
        s.className = "chip";
        s.textContent = label;
        infoChips.appendChild(s);
      };
      make("Language: " + lang);
      make("PSM: " + psm);
      make(
        "Confidence: " +
          (data.confidence != null ? Math.round(data.confidence) : "—")
      );
      make("Blocks: " + (data.blocks ? data.blocks.length : "—"));

      console.log(extractNameFromCertificate(data.text));
      const extractedName = extractNameFromCertificate(data.text);
      document.getElementById("holderName").textContent = extractedName;

      await worker.terminate();
      setProgress(100);
      setStatus("Done.");
    } catch (e) {
      console.error(e);
      setError("OCR failed: " + (e && e.message ? e.message : e));
      setStatus("Ready.");
      setProgress(0);
    }
  });

  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    previewWrap.style.display = "none";
    preview.removeAttribute("src");
    output.value = "";
    currentImageBlob = null;
    setProgress(0);
    setStatus("Cleared.");
    setError("");
    infoChips.innerHTML = "";
    document.getElementById("holderName").textContent = "No name extracted yet";
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.value || "");
      setStatus("Copied to clipboard.");
    } catch {
      setError("Could not copy to clipboard.");
    }
  });

  saveBtn.addEventListener("click", () => {
    const blob = new Blob([output.value || ""], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr-output.txt";
    a.click();
    URL.revokeObjectURL(url);
  });
})();
