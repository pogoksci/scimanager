// ================================================================
// /js/components/sort-dropdown.js — 공용 정렬 드롭다운 모듈
// Deno Lint 0 / App.SortDropdown 호환 / 재사용 가능 구조
// ================================================================
(function () {
  console.log("🔽 SortDropdown 모듈 로드됨");

  /**
   * @typedef {Object} SortDropdownOptions
   * @property {function(string):void} onChange - 정렬 기준 변경 시 실행
   * @property {function():void} onRefresh - 새로고침 버튼 클릭 시 실행
   * @property {string} [defaultLabel="정렬 기준"] - 초기 라벨
   * @property {string} [defaultValue=""] - 초기 정렬값
   */

  /**
   * 정렬 드롭다운 초기화
   * @param {SortDropdownOptions} opts
   */
  function init(opts = {}) {
    const {
      onChange = () => { },
      onRefresh = () => { },
      defaultLabel = "정렬 기준",
      defaultValue = "",
      toggleId = "sort-toggle",
      menuId = "sort-menu",
      labelId = "sort-label"
    } = opts;

    const maxRetries = 10;
    let retries = 0;

    function attemptInit() {
      const toggle = document.getElementById(toggleId);
      const menu = document.getElementById(menuId);
      const label = document.getElementById(labelId);
      const refreshBtn = document.getElementById("refresh-btn") || document.getElementById("aid-refresh-btn") || document.getElementById("kit-refresh-btn");

      if (!toggle || !menu || !label) {
        if (retries < maxRetries) {
          retries++;
          // console.warn(`⚠️ SortDropdown waiting for DOM (${retries}/${maxRetries})...`);
          setTimeout(attemptInit, 100);
          return;
        }
        // console.warn("⚠️ SortDropdown 요소를 찾을 수 없습니다 (Timeout).");
        return;
      }

      // ✅ 초기 라벨 설정
      label.textContent = defaultLabel;
      label.dataset.value = defaultValue;

      // ✅ 기존 리스너 제거 (Clone Node)
      const newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);

      // ✅ [Fix] Clone 후 label 요소 다시 찾기 (참조 끊김 방지)
      const newLabel = newToggle.querySelector(`#${labelId}`) || document.getElementById(labelId);

      newToggle.addEventListener("click", (e) => {
        // console.log("🖱️ Sort Toggle Clicked");
        e.stopPropagation();
        menu.classList.toggle("open");
      });

      // ✅ 옵션 클릭 처리
      menu.querySelectorAll(".dropdown-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const value = item.dataset.value || "";
          const textNode = Array.from(item.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          const text = textNode ? textNode.textContent.trim() : item.textContent.trim();

          if (newLabel) {
            newLabel.textContent = text;
            newLabel.dataset.value = value;
          }
          menu.classList.remove("open");

          if (typeof onChange === "function") {
            onChange(value);
          }
        });
      });

      // ✅ 외부 클릭 시 닫기
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && !newToggle.contains(e.target)) {
          menu.classList.remove("open");
        }
      });

      // ✅ 새로고침 버튼
      if (refreshBtn) {
        // Prevent multiple bindings
        const newRefresh = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefresh, refreshBtn);

        newRefresh.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof onRefresh === "function") onRefresh();
        });
      }

      console.log("✅ SortDropdown 초기화 완료");
    }

    attemptInit();
  }

  // ------------------------------------------------------------
  // 전역 등록 (App.SortDropdown)
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.SortDropdown = { init };
})();
