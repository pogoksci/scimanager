// /js/ui/inventory-detail.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  const _toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const formatWithUnit = (val, unit = "") => {
    if (val === null || val === undefined || val === "") return "-";
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    return `${n}${unit}`;
  };

  const formatTemp = (val) => formatWithUnit(val, " C");

  const formatDensity = (val) => {
    if (val === null || val === undefined || val === "") return "-";
    const raw = String(val).trim();
    if (!raw) return "-";

    if (raw.includes("@")) {
      const [valuePart, ...rest] = raw.split("@");
      const value = valuePart.trim();
      const temp = rest.join("@").trim();
      return temp ? `${value} <span class="density-temp-note">@ ${temp}</span>` : value || "-";
    }

    const n = Number(raw);
    if (Number.isFinite(n)) return `${n} g/mL`;
    return raw;
  };

  function renderSvg(structureString, target) {
    if (!target) return;
    if (structureString) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(structureString, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (svg) {
          target.innerHTML = "";
          target.appendChild(svg);
          return;
        }
      } catch (e) {
        console.warn("SVG parsing failed:", e);
      }
    }
    target.innerHTML = `<span class="structure-placeholder">구조식 이미지 없음</span>`;
  }

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("선택된 재고가 없습니다.");
        return;
      }

      // ✅ Sync with localStorage immediately so reload / back / forward works
      localStorage.setItem("selected_inventory_id", inventoryId);

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
        id, state, current_amount, initial_amount, unit, classification, manufacturer, purchase_date, photo_url_320, photo_url_160,
        door_vertical, door_horizontal, internal_shelf_level, storage_column, msds_pdf_url,
        concentration_value, concentration_unit, valence,
        converted_concentration_value_1, converted_concentration_unit_1,
        converted_concentration_value_2, converted_concentration_unit_2,
        school_hazardous_chemical, school_accident_precaution_chemical, special_health_checkup_hazardous_factor,
        toxic_substance, permitted_substance, restricted_substance, prohibited_substance,
        bottle_mass, bottle_identifier, bottle_type, edited_name_kor,
        Substance (
          id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor, chem_name_kor_mod, substance_name_mod, molecular_formula_mod, svg_image, has_molfile,
          school_hazardous_chemical_standard, school_accident_precaution_chemical_standard, special_health_checkup_hazardous_factor_standard,
          toxic_substance_standard, permitted_substance_standard, restricted_substance_standard, prohibited_substance_standard,
          Properties ( name, property ),
          MSDS ( section_number, content ),
          HazardClassifications (*)
        ),
        Cabinet ( id, cabinet_name, area_id, door_horizontal_count, area_id:lab_rooms!fk_cabinet_lab_rooms ( id, room_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      // Populate Hazard Summary Table
      const setHazardVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "-";
      };

      // 1. Standard Values (from Substance)
      setHazardVal("std-school-hazard-toxic", data.Substance?.school_hazardous_chemical_standard);
      setHazardVal("std-school-hazard-accident", data.Substance?.school_accident_precaution_chemical_standard);
      setHazardVal("std-special-health", data.Substance?.special_health_checkup_hazardous_factor_standard);
      setHazardVal("std-toxic", data.Substance?.toxic_substance_standard);
      setHazardVal("std-permitted", data.Substance?.permitted_substance_standard);
      setHazardVal("std-restricted", data.Substance?.restricted_substance_standard);
      setHazardVal("std-prohibited", data.Substance?.prohibited_substance_standard);

      // 2. Inventory Values (from Inventory)
      setHazardVal("val-school-hazard-toxic", data.school_hazardous_chemical);
      setHazardVal("val-school-hazard-accident", data.school_accident_precaution_chemical);
      setHazardVal("val-special-health", data.special_health_checkup_hazardous_factor);
      setHazardVal("val-toxic", data.toxic_substance);
      setHazardVal("val-permitted", data.permitted_substance);
      setHazardVal("val-restricted", data.restricted_substance);
      setHazardVal("val-prohibited", data.prohibited_substance);

      // ✅ Override Logic
      const korName = data.edited_name_kor || data.Substance?.chem_name_kor_mod || data.Substance?.chem_name_kor || data.Substance?.substance_name_mod || data.Substance?.substance_name || "이름 없음";
      const engName = data.Substance?.substance_name_mod || data.Substance?.substance_name || "";
      const formula = data.Substance?.molecular_formula_mod || data.Substance?.molecular_formula || "-";

      document.getElementById("detail-name-kor").innerHTML = korName;
      document.getElementById("detail-name-eng").innerHTML = engName !== korName ? engName : "";

      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="시약 사진" class="inventory-detail-photo-img">`
        : `<span>사진 없음</span>`;

      if (data.id) {
        document.getElementById("detail-substance-id").textContent = `No.${data.id}`;
      }

      const btnGoUsage = document.getElementById("btn-go-usage");
      if (btnGoUsage) {
        // ✅ Permission Check: Hide for Guest/Student
        if (getApp().Auth && typeof getApp().Auth.canWrite === 'function' && !getApp().Auth.canWrite()) {
          btnGoUsage.style.display = "none";
        } else {
          btnGoUsage.style.display = "inline-block"; // Ensure visible for authorized users
          btnGoUsage.onclick = async () => {
            // Navigate to usageRegister with inventory info
            if (getApp().Router?.go) {
              await getApp().Router.go("usageRegister", { inventoryId: data.id, detail: data });
            } else {
              alert("수불 등록 화면으로 이동할 수 없습니다.");
            }
          };
        }
      }

      // ---------------------------------------------------------
      // 🧪 Smart Concentration Conversion Button
      // ---------------------------------------------------------
      const btnOpenConc = document.getElementById("btn-open-conc-calc");
      if (btnOpenConc) {
        btnOpenConc.onclick = () => {
          if (getApp().ConcentrationConversion?.openModal) {
            getApp().ConcentrationConversion.openModal(data);
          } else {
            console.warn("ConcentrationConversion module not found.");
            alert("농도 변환 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
          }
        };
      }

      const rawCas = data.Substance?.cas_rn || "";
      const isValidCas = /^\d+-\d+-\d$/.test(rawCas.trim());
      const displayCas = isValidCas ? rawCas : (rawCas ? "CAS없음" : "-");

      document.getElementById("detail-cas").textContent = displayCas;
      document.getElementById("detail-formula").innerHTML = formula;
      document.getElementById("detail-class").textContent = data.classification || "-";
      document.getElementById("detail-state").textContent = data.state || "-";
      document.getElementById("detail-manufacturer").textContent = data.manufacturer || "-";

      const amount = data.current_amount != null ? data.current_amount : "-";
      const unit = data.unit || "";
      const currentAmountVal = Number(data.current_amount || 0);
      const initialAmountVal = Number(data.initial_amount || 0);

      let amountHtml = `${amount}${unit}`;

      // ⚠️ Low Stock Badge (Detail View)
      if (initialAmountVal > 0 && currentAmountVal <= (initialAmountVal * 0.2)) {
        amountHtml += ` <span class="low-stock-badge-detail">구입요청</span>`;
      }

      document.getElementById("detail-quantity").innerHTML = amountHtml;

      // Location Formatting
      // ✅ [수정됨] Area -> area_id:lab_rooms, room_name
      const area = data.Cabinet?.area_id?.room_name || "";
      const cab = data.Cabinet?.cabinet_name || "";
      const v = data.door_vertical || "";
      const h = data.door_horizontal || "";
      const hCount = Number(data.Cabinet?.door_horizontal_count || data.door_horizontal_count || 0);

      let locText = "";
      if (area) locText += `${area} `;
      if (cab) locText += `『${cab}』 `;

      let doorPart = "";
      const doorHVal = String(h || "").trim();
      let doorHLabel = "";
      if (hCount > 1) {
        if (doorHVal === "1") doorHLabel = "왼쪽";
        else if (doorHVal === "2") doorHLabel = "오른쪽";
        else doorHLabel = doorHVal;
      }

      if (v && doorHLabel) {
        doorPart = `${v}층 ${doorHLabel}문`;
      } else if (v) {
        doorPart = `${v}층문`;
      } else if (doorHLabel) {
        doorPart = `${doorHLabel}문`;
      }

      let shelfPart = "";
      const shelfVal = data.internal_shelf_level;
      const colVal = data.storage_column;

      if (shelfVal && colVal) {
        shelfPart = `${shelfVal}단 ${colVal}열`;
      } else {
        if (shelfVal) shelfPart += `${shelfVal}단`;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}열`;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "위치: 미확인";
      document.getElementById("detail-location").textContent = locText;

      const dateStr = data.purchase_date || data.created_at;
      let formattedDate = "-";
      if (dateStr) {
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        formattedDate = `${year}-${month}-${day}`;
      }
      document.getElementById("detail-created-at").textContent = formattedDate;

      const propsList = data.Substance?.Properties || [];
      const getPropVal = (nameKey) => {
        const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
        return found ? found.property : null;
      };

      const boilingPoint = getPropVal("Boiling Point");
      const meltingPoint = getPropVal("Melting Point");
      const density = getPropVal("Density");

      // PubChem CID Helper
      let cachedCid = null;
      const loadPubChemCid = async () => {
        if (cachedCid) return cachedCid;
        let casRn = data.Substance?.cas_rn;
        if (!casRn) return null;

        casRn = String(casRn).trim();
        // Defensive Logic: Check if it looks like a valid CAS RN (digits-digits-digit)
        // This prevents calling PubChem API with junk data like '-154'
        const casRegex = /^\d+-\d+-\d$/;
        if (!casRegex.test(casRn)) {
          console.warn(`[InventoryDetail] Invalid CAS format skipped for PubChem: [${casRn}]`);
          return null;
        }

        try {
          const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${casRn}/cids/JSON`);
          if (!res.ok) return null;
          const json = await res.json();
          cachedCid = json.IdentifierList?.CID?.[0];
          return cachedCid;
        } catch (e) {
          console.warn("CID Fetch Error:", e);
          return null;
        }
      };

      // Load 2D Image
      const structureBox = document.getElementById("detail-structure");
      (async () => {
        structureBox.innerHTML = '<span class="structure-placeholder" style="font-size:12px; color:#999;">Loading...</span>';
        const cid = await loadPubChemCid();
        if (cid) {
          const imgUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=300x300`;
          structureBox.innerHTML = `<img src="${imgUrl}" alt="Structure" class="structure-img-2d">`;
        } else {
          if (data.Substance?.svg_image) {
            renderSvg(data.Substance.svg_image, structureBox);
          } else {
            structureBox.innerHTML = '<span class="structure-placeholder">이미지 없음</span>';
          }
        }
      })();

      document.getElementById("detail-boiling").textContent = formatTemp(boilingPoint);
      document.getElementById("detail-melting").textContent = formatTemp(meltingPoint);

      const densityEl = document.getElementById("detail-density");
      if (densityEl) {
        densityEl.innerHTML = formatDensity(density);
      }

      // Original Concentration
      // ---------------------------------------------------------
      // Concentration & Conversion Display Logic
      // ---------------------------------------------------------

      // Helper to format unit display
      const formatUnitDisplay = (u) => {
        if (!u) return "";
        // Replace % with % (w/w) if not already present
        if (u.includes("%") && !u.includes("(w/w)")) {
          return u.replace("%", "% (w/w)");
        }
        return u;
      };

      // 1. Original Concentration
      const rawConcUnit = data.concentration_unit || "";
      const displayConcUnit = formatUnitDisplay(rawConcUnit);
      let concVal = data.concentration_value ? `${data.concentration_value} ${displayConcUnit}` : "-";

      // ✅ Display Valence if Unit is N
      if (data.concentration_unit === "N" && data.valence) {
        concVal += ` (가수: ${data.valence})`;
      }

      document.getElementById("detail-concentration").textContent = concVal;

      const formatConvVal = (num, unitText) => {
        if (num === null || num === undefined) return "계산불가"; // Explicit failure message
        const n = Number(num);
        if (!Number.isFinite(n)) return "계산불가";
        return `${n.toFixed(3)} ${formatUnitDisplay(unitText)}`;
      };

      const convState = {
        label1: "변환농도1",
        label2: "변환농도2",
        value1: "-",
        value2: "-",
        isError1: false,
        isError2: false
      };

      // Infer expected targets based on source unit
      let target1 = { label: "변환농도1", unit: "" };
      let target2 = { label: "변환농도2", unit: "" };

      // Normalizing check
      const sourceUnitNorm = rawConcUnit.trim();

      if (sourceUnitNorm.includes("%")) {
        target1 = { label: "몰농도", unit: "M" };
        target2 = { label: "몰랄농도", unit: "m" };
      } else if (sourceUnitNorm.toUpperCase().startsWith("M") || sourceUnitNorm.toUpperCase().startsWith("N")) {
        target1 = { label: "퍼센트농도", unit: "%" };
        target2 = { label: "몰랄농도", unit: "m" };
      }

      const annotateUnit = (unit) => {
        const stateVal = String(data.state || "").trim().toLowerCase();
        const solids = ["파우더", "조각", "비드", "펠렛", "리본", "막대", "벌크", "고체"];
        const isSolid = solids.some((k) => stateVal.includes(k));
        const isGas = stateVal.includes("기체") || stateVal.includes("gas");
        const isLiquid = stateVal === "액체" || stateVal.includes("liquid");

        if (unit === "M" && (isSolid || isGas)) return `${unit} (의미 없음)`;
        if (unit === "m" && (isLiquid || isGas)) return `${unit} (정의 불가)`;
        return unit;
      };

      // Set Labels
      convState.label1 = target1.label + ":";
      convState.label2 = target2.label + ":";

      // Calculate Value 1
      if (data.concentration_value) {
        if (data.converted_concentration_value_1 != null) {
          const u = annotateUnit(data.converted_concentration_unit_1 || target1.unit);
          convState.value1 = formatConvVal(data.converted_concentration_value_1, u);
        } else if (target1.unit) {
          // Input exists but output is null -> Calculation Impossible
          convState.value1 = "계산불가";
          convState.isError1 = true;
        }
      }

      // Calculate Value 2
      if (data.concentration_value) {
        if (data.converted_concentration_value_2 != null) {
          const u = annotateUnit(data.converted_concentration_unit_2 || target2.unit);
          convState.value2 = formatConvVal(data.converted_concentration_value_2, u);
        } else if (target2.unit) {
          // Input exists but output is null -> Calculation Impossible
          convState.value2 = "계산불가";
          convState.isError2 = true;
        }
      }

      const convLabel1El = document.getElementById("conv-label-1");
      const convLabel2El = document.getElementById("conv-label-2");
      const convValue1El = document.getElementById("conv-value-1");
      const convValue2El = document.getElementById("conv-value-2");

      const formatWithParenSmall = (val) => {
        if (!val) return "-";
        const str = String(val);
        const idx = str.indexOf("(");
        if (idx !== -1) {
          const main = str.substring(0, idx);
          const sub = str.substring(idx);
          return `${main}<span style="font-size: 10px;">${sub}</span>`;
        }
        return str;
      };

      if (convLabel1El) convLabel1El.textContent = convState.label1;
      if (convLabel2El) convLabel2El.textContent = convState.label2;

      if (convValue1El) {
        // Red color for "계산불가"
        if (convState.isError1 || convState.value1 === "계산불가") {
          convValue1El.style.color = "#e74c3c"; // Red
          convValue1El.style.fontWeight = "bold";
          convValue1El.textContent = convState.value1;
        } else {
          convValue1El.style.color = "";
          convValue1El.style.fontWeight = "";

          if (convState.value1.includes("(의미 없음)") || convState.value1.includes("(정의 불가)")) {
            convValue1El.classList.add("text-muted-small");
          } else {
            convValue1El.classList.remove("text-muted-small");
          }
          convValue1El.innerHTML = formatWithParenSmall(convState.value1);
        }
      }

      if (convValue2El) {
        if (convState.isError2 || convState.value2 === "계산불가") {
          convValue2El.style.color = "#e74c3c";
          convValue2El.style.fontWeight = "bold";
          convValue2El.textContent = convState.value2;
        } else {
          convValue2El.style.color = "";
          convValue2El.style.fontWeight = "";

          if (convState.value2.includes("(의미 없음)") || convState.value2.includes("(정의 불가)")) {
            convValue2El.classList.add("text-muted-small");
          } else {
            convValue2El.classList.remove("text-muted-small");
          }
          convValue2El.innerHTML = formatWithParenSmall(convState.value2);
        }
      }

      const msdsTitles = [
        "1. 화학제품과 회사에 관한 정보",
        "2. 유해성·위험성",
        "3. 구성성분의 명칭 및 함유량",
        "4. 응급조치 요령",
        "5. 화재 시 조치방법",
        "6. 누출 시 조치방법",
        "7. 취급 및 저장방법",
        "8. 노출방지 및 개인보호구",
        "9. 물리화학적 특성",
        "10. 안정성 및 반응성",
        "11. 독성에 관한 정보",
        "12. 환경에 미치는 영향",
        "13. 폐기 시 주의사항",
        "14. 운송에 필요한 정보",
        "15. 법적 규제현황",
        "16. 그 밖의 참고사항",
      ];

      const ghsMapping = {
        "01": "폭발성(Explosive)\n· 불안정한 폭발물\n· 폭발물\n· 자기반응성 물질 및 혼합물\n· 유기과산화물",
        "02": "인화성(Flammable)\n· 인화성 가스\n· 가연성 에어로졸\n· 인화성 액체\n· 인화성 고체\n· 자기반응성 물질 및 혼합물\n· 발화성 액체\n· 발화성 고체\n· 가연성 고체\n· 가연성 액체\n· 자체 발열 물질 및 혼합물\n· 물과 접촉하여 가연성 가스를 방출하는 물질 및 혼합물\n· 유기 과산화물",
        "03": "산화성(Oxidizing)\n· 산화 가스\n· 산화성 액체\n· 산화성 고체",
        "04": "고압 가스(Compressed Gas)\n· 압축 가스\n· 액화 가스\n· 냉장 액화 가스\n· 용존 가스",
        "05": "부식성(Corrosive)\n· 금속 부식성\n· 폭발물\n· 인화성 가스\n· 자기 반응성물질 및 혼합물\n· 유기 과산화물\n· 피부부식\n· 심각한 눈 손상",
        "06": "유독성(Toxic)\n· 급성 독성",
        "07": "경고(Health Hazard, Hazardous to Ozone Layer)\n· 급성 독성\n· 피부 자극성\n· 눈 자극성\n· 피부 과민성\n· 특정 표적 장기 독성(호흡기 자극, 마약 효과)",
        "08": "건강 유해성(Serious Health hazard)\n· 호흡기 과민성\n· 생식세포 변이원성\n· 발암성\n· 생식독성\n· 특정표적장기 독성\n· 흡인 위험",
        "09": "수생 환경 유독성(Hazardous to the Environment)\n· 수생환경 유해성",
      };

      const msdsData = data.Substance?.MSDS || [];
      const accordionContainer = document.getElementById("msds-accordion");

      if (accordionContainer) {
        accordionContainer.innerHTML = msdsTitles
          .map((title, index) => {
            const sectionNum = index + 1;
            const sectionData = msdsData.find((d) => d.section_number === sectionNum);
            let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음 (데이터 동기화 필요)</p>';

            if (sectionData && sectionData.content) {
              if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
                    const parts = row.split("|||");
                    if (parts.length >= 3) {
                      const [no, name, detail] = parts;

                      if (name.trim() === "그림문자") {
                        const ghsCodes = detail.trim().split(/\s+/).filter((s) => s.endsWith(".gif"));
                        if (ghsCodes.length > 0) {
                          const ghsTableRows = ghsCodes
                            .map((code) => {
                              const match = code.match(/GHS(\d+)\.gif/i);
                              if (match) {
                                const num = match[1];
                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                const fullDesc = ghsMapping[num] || "분류 정보 없음";
                                const lines = fullDesc.split("\n");
                                const titleLine = lines[0];
                                const detailLines = lines.slice(1).join("<br>");

                                let korName = titleLine;
                                let engName = "";
                                const matchTitle = titleLine.match(/^(.*)\((.*)\)$/);
                                if (matchTitle) {
                                  korName = matchTitle[1].trim();
                                  engName = matchTitle[2].trim();
                                }

                                return `<tr class="ghs-row"><td class="ghs-cell-image"><img src="${imgUrl}" alt="${code}" class="ghs-image"><div class="ghs-name-kor">${korName}</div><div class="ghs-name-eng">${engName}</div></td><td class="ghs-cell-desc">${detailLines}</td></tr>`;
                              }
                              return "";
                            })
                            .join("");

                          return `
                            <div class="msds-row">
                              <div class="msds-header">${no} ${name}</div>
                              <div class="msds-content msds-no-padding"><table class="ghs-table">${ghsTableRows}</table></div>
                            </div>
                          `;
                        }
                      }

                      return `
                        <div class="msds-row">
                          <div class="msds-header">${no} ${name}</div>
                          <div class="msds-content">${detail}</div>
                        </div>
                      `;
                    } else {
                      return `<div class="msds-simple-content">${row}</div>`;
                    }
                  })
                  .join("");
                contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
              } else if (sectionData.content.includes("|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
                    const parts = row.split("|||");
                    if (parts.length >= 3) {
                      const [no, name, detail] = parts;
                      return `
                        <div class="msds-row">
                          <div class="msds-header">${no} ${name}</div>
                          <div class="msds-content">${detail}</div>
                        </div>
                      `;
                    } else {
                      return `<div class="msds-simple-content">${row}</div>`;
                    }
                  })
                  .join("");
                contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
              } else {
                contentHtml = `<div class="msds-simple-content">${sectionData.content.replace(/\n/g, "<br>")}</div>`;
              }
            }

            return `
              <div class="accordion-item">
                  <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                      ${title}
                  </button>
                  <div class="accordion-content">
                      ${contentHtml}
                  </div>
              </div>
            `;
          })
          .join("");
      }

      // ---------------------------------------------------------
      // MSDS PDF Button Logic (Redesigned)
      // ---------------------------------------------------------
      const btnDownloadMsds = document.getElementById("btn-download-msds-row");
      if (btnDownloadMsds) {
        const icon = btnDownloadMsds.querySelector(".icon");
        const text = btnDownloadMsds.querySelector(".btn-text");

        if (data.msds_pdf_url) {
          btnDownloadMsds.disabled = false;
          if (icon) icon.textContent = "picture_as_pdf";
          if (text) text.textContent = "MSDS PDF";

          btnDownloadMsds.onclick = () => {
            globalThis.open(data.msds_pdf_url, "_blank");
          };
        } else {
          btnDownloadMsds.disabled = true;
          if (icon) icon.textContent = "block";
          if (text) text.textContent = "MSDS PDF 없음";
          btnDownloadMsds.onclick = null;
        }
      }

      const hazardContainer = document.getElementById("hazard-info-container");
      const _hazards = data.Substance?.HazardClassifications || [];
      const substanceId = data.Substance?.id;

      const { data: hazardData, error: hazardError } = await supabase
        .from("HazardClassifications")
        .select("*")
        .eq("substance_id", substanceId);

      if (hazardError) {
        console.error("유해화학물질 정보 조회 오류:", hazardError);
        if (hazardContainer) hazardContainer.innerHTML = `<p class="text-red-500">정보 조회 실패</p>`;
      } else if (hazardData && hazardData.length > 0) {
        if (hazardContainer) {
          const accordion = hazardData
            .map((item, idx) => {
              const baseTitle = (item.sbstnClsfTypeNm || "").trim() || `분류 ${idx + 1}`;
              const displayTitle = `${idx + 1}. ${baseTitle}`;
              const unq = item.unqNo || "-";
              const cont = item.contInfo || "-";
              const info = item.ancmntInfo || "-";
              const ymd = item.ancmntYmd || "-";
              return `
                <div class="hazard-acc-item">
                  <button class="hazard-acc-header" type="button">
                    <span class="hazard-acc-title">${displayTitle}</span>
                    <span class="hazard-acc-arrow" aria-hidden="true">▼</span>
                  </button>
                  <div class="hazard-acc-content">
                    <table class="hazard-table">
                      <thead>
                        <tr>
                          <th>고유 번호</th>
                          <th>내용</th>
                          <th>고시 정보</th>
                          <th>고시 일자</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>${unq}</td>
                          <td>${cont}</td>
                          <td>${info}</td>
                          <td>${ymd}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
            })
            .join("");

          hazardContainer.innerHTML = `<div class="hazard-accordion">${accordion}</div>`;

          hazardContainer.querySelectorAll(".hazard-acc-header").forEach((btn) => {
            btn.addEventListener("click", () => {
              btn.parentElement.classList.toggle("open");
            });
          });
        }
      } else {
        if (hazardContainer) {
          hazardContainer.innerHTML = "<p class='text-gray-500'>해당 물질의 유해화학물질 분류 정보가 없습니다.</p>";
        }
      }

      document.getElementById("detail-back-btn")?.addEventListener("click", async () => {
        if (getApp().Router?.go) {
          await getApp().Router.go("inventory");
        } else if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        // Permission Check
        const userRole = (getApp().Auth && getApp().Auth.user && getApp().Auth.user.role) ? getApp().Auth.user.role : 'guest';
        if (['guest', 'student'].includes(userRole)) {
          alert('권한이 없습니다.');
          return;
        }

        if (!confirm("정말 삭제하시겠습니까?\n(마지막 재고인 경우 물질 정보와 파일도 함께 삭제됩니다.)")) return;

        try {
          // Use system-admin function for safe cascading delete (Files + Orphan Substance)
          const { data, error } = await App.supabase.functions.invoke("system-admin", {
            body: { action: "delete_inventory", inventory_id: inventoryId },
          });

          if (error) throw error;

          if (data && data.error) throw new Error(data.error);

          console.log("Delete Success:", data);
          alert("삭제되었습니다.");

          if (getApp().Router?.go) {
            await getApp().Router.go("inventory");
          } else if (getApp().Inventory?.showListPage) {
            await getApp().Inventory.showListPage();
          }
        } catch (err) {
          console.error("Delete Failed:", err);
          alert("삭제 중 오류가 발생했습니다: " + err.message);
        }
      });


      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        // Permission Check
        const userRole = (getApp().Auth && getApp().Auth.user && getApp().Auth.user.role) ? getApp().Auth.user.role : 'guest';
        if (['guest', 'student'].includes(userRole)) {
          alert('권한이 없습니다.');
          return;
        }

        if (getApp().Router?.go) {
          await getApp().Router.go("addInventory", { mode: "edit", detail: data });
        } else {
          alert("편집 모드로 전환 (구현 필요)");
        }
      });

      // Initial Visibility Check
      const userRoleRaw = (getApp().Auth && getApp().Auth.user && getApp().Auth.user.role) ? getApp().Auth.user.role : 'guest';
      if (!['guest', 'student'].includes(userRoleRaw)) {
        const delBtn = document.getElementById("delete-inventory-btn");
        if (delBtn) delBtn.style.display = 'inline-block';

        const editBtn = document.getElementById("edit-inventory-btn");
        if (editBtn) editBtn.style.display = 'inline-block';
      }

      // ---------------------------------------------------------
      // 3D Viewer Logic
      // ---------------------------------------------------------
      const btn2d = document.getElementById("btn-view-2d");
      const btn3d = document.getElementById("btn-view-3d");
      const btnZoomIn = document.getElementById("btn-zoom-in");
      const btnZoomOut = document.getElementById("btn-zoom-out");
      const box2d = document.getElementById("detail-structure");
      const box3d = document.getElementById("detail-structure-3d");
      const structureWrapper = document.querySelector(".structure-wrapper");
      let _viewer3d = null;
      let currentZoom = 1.0;

      const applyZoom = () => {
        const target = box2d.querySelector("img, svg");
        if (target && box2d.style.display !== "none") {
          target.style.transform = `scale(${currentZoom})`;
        }
      };

      const setViewMode = (mode) => {
        const is2d = mode === "2d";
        if (structureWrapper) {
          structureWrapper.dataset.viewMode = mode;
        }
        btn2d.classList.toggle("active", is2d);
        btn3d.classList.toggle("active", !is2d);
        box2d.style.display = is2d ? "block" : "none";
        box3d.style.display = is2d ? "none" : "block";

        if (is2d) {
          currentZoom = 1.0;
          applyZoom();
        } else {
          // 3D mode: zoom is handled by viewer
        }
      };

      if (btn2d && btn3d && box2d && box3d) {
        if (structureWrapper) {
          structureWrapper.dataset.viewMode = "2d";
        }

        if (btnZoomIn && btnZoomOut) {
          btnZoomIn.onclick = () => {
            if (box2d.style.display !== "none") {
              currentZoom += 0.2;
              applyZoom();
            } else if (_viewer3d) {
              _viewer3d.zoom(1.2);
            }
          };
          btnZoomOut.onclick = () => {
            if (box2d.style.display !== "none") {
              currentZoom = Math.max(0.2, currentZoom - 0.2);
              applyZoom();
            } else if (_viewer3d) {
              _viewer3d.zoom(0.8);
            }
          };
        }

        btn2d.onclick = () => {
          setViewMode("2d");
        };

        // ---------------------------------------------------------
        // MOL Download Logic (Redesigned)
        // ---------------------------------------------------------
        const btnDownloadMol = document.getElementById("btn-download-mol-row");
        if (btnDownloadMol) {
          const icon = btnDownloadMol.querySelector(".icon");
          const text = btnDownloadMol.querySelector(".btn-text");

          if (data.Substance?.has_molfile) {
            btnDownloadMol.disabled = false;
            if (icon) icon.textContent = "download";
            if (text) text.textContent = "Mol";

            btnDownloadMol.onclick = () => {
              const substanceId = data.Substance.id;
              const casRn = data.Substance.cas_rn;
              if (!substanceId) return;

              try {
                const app = getApp();
                const fnBase = app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
                if (!fnBase) {
                  alert("함수 호출 경로를 찾을 수 없습니다.");
                  return;
                }

                const downloadUrl = `${fnBase}/casimport?type=download_mol&substance_id=${substanceId}`;

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', `${casRn || 'structure'}.mol`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

              } catch (e) {
                console.error("Download failed:", e);
                alert("다운로드 요청 중 오류가 발생했습니다.");
              }
            };
          } else {
            btnDownloadMol.disabled = true;
            if (icon) icon.textContent = "block";
            if (text) text.textContent = "Mol 파일 없음";
            btnDownloadMol.onclick = null;
          }
        }

        btn3d.onclick = async () => {
          setViewMode("3d");

          const show3dFallback = (msg) => {
            box3d.style.backgroundColor = "#f9f9f9";
            box3d.innerHTML =
              `<div class="structure-error" style="display:flex;align-items:center;justify-content:center;height:100%;">${msg || '3D 구조 데이터 없음'}</div>`;
          };

          // If viewer already exists and has models, just render (optional optimization)
          // But for simplicity and safety, we reload if it's empty or check if initialized.
          // Since we might switch substances in SPA (though this is detail page), let's check if we have data.
          // For now, let's always try to load if not loaded.

          if (_viewer3d && _viewer3d.getModelCount() > 0) {
            return;
          }

          const casRn = data.Substance?.cas_rn;
          if (!casRn) {
            show3dFallback();
            return;
          }

          try {
            box3d.innerHTML = '<div class="structure-error" style="display:flex; align-items:center; justify-content:center; height:100%; color:#666;">3D 구조 로딩 중...</div>';

            // 1. Get CID
            const cid = await loadPubChemCid();
            if (!cid) {
              show3dFallback();
              return;
            }

            // 2. Fetch SDF
            const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
            const resp = await fetch(sdfUrl);
            if (!resp.ok) {
              if (resp.status === 404) {
                show3dFallback("3D 구조 데이터 없음");
              } else {
                show3dFallback("3D 데이터 다운로드 실패");
                console.warn(`3D Download Failed: ${resp.status}`);
              }
              return;
            }
            const sdfData = await resp.text();

            // 3. Init 3Dmol
            box3d.innerHTML = ""; // Clear loading msg
            // Ensure box3d has size
            if (!box3d.style.height) box3d.style.height = "100%";

            if (!_viewer3d) {
              // @ts-ignore
              _viewer3d = $3Dmol.createViewer(box3d, {
                backgroundColor: "black",
                id: "molviewer"
              });
            }

            _viewer3d.removeAllModels();
            _viewer3d.addModel(sdfData, "sdf");
            _viewer3d.setStyle({}, { stick: {}, sphere: { scale: 0.3 } }); // Ball and Stick
            _viewer3d.zoomTo();
            _viewer3d.render();

          } catch (e) {
            console.error("3D Load Error:", e);
            show3dFallback("오류 발생");
          }
        };
      }

      if (data.Substance?.cas_rn) {
        const checkUpdate = async () => {
          try {
            const casRn = String(data.Substance.cas_rn).trim();
            const casRegex = /^\d+-\d+-\d$/;
            if (!casRegex.test(casRn)) return;

            const app = getApp();
            const fnBase = app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
            if (!fnBase) return;

            const headers = app.supabaseAnonKey
              ? { apikey: app.supabaseAnonKey, Authorization: `Bearer ${app.supabaseAnonKey}`, "Content-Type": "application/json" }
              : { "Content-Type": "application/json" };

            const res = await fetch(`${fnBase}/casimport?type=check_update`, {
              method: "POST",
              headers,
              body: JSON.stringify({ cas_rn: data.Substance.cas_rn }),
            });

            if (res.ok) {
              const result = await res.json();
              if (result.status === "updated") {
                loadInventoryDetail(inventoryId);
              }
            }
          } catch (e) {
            console.warn("Auto-update check failed:", e);
          }
        };
        checkUpdate();
      }
    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      const detailPage = document.getElementById("inventory-detail-page");
      if (detailPage) {
        detailPage.innerHTML = `<p style="padding: 20px; color: red;">오류: ${err.message}</p>`;
      }
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
